/**
 * Ce que POST /api/btp accepte d'écrire, table par table (constat donnees-btp-9 de l'audit du 11/11/2026).
 *
 * Colonnes : relevé de la base de PRODUCTION du 11/11/2026 (information_schema, lecture seule), qui diffère des
 * migrations du dépôt, plus chantiers_btp.membres_ids (migration 20261116 du pointage géolocalisé, appliquée en
 * production le 16/11/2026). tests/lib/btp-schema-tables.test.ts recopie ce relevé et échoue si les deux divergent.
 *
 * Trois niveaux de contrôle :
 *   1. colonnes, types, champs obligatoires (verifierLigne) : ne refusent que ce que la base aurait refusé elle-même
 *      (colonne inconnue, texte dans un nombre, identifiant mal formé, NOT NULL vide) ; le refus devient un message
 *      clair (400) au lieu d'une « Erreur serveur ». Types volontairement larges, comme la base : un nombre peut
 *      arriver en texte (« 12000 »), une date ou une heure en texte, un JSON sous n'importe quelle forme.
 *   2. bornes métier (valeursHorsBornes) : montant négatif, taux hors 0-100, coordonnées impossibles. C'est le seul
 *      contrôle plus strict que la base. La route l'applique à la création, et à la modification seulement si la
 *      valeur change : une valeur déjà en base, renvoyée telle quelle par un formulaire, est acceptée (et signalée).
 *   3. rattachements (referencesDeLigne) : chantier, membre ou équipe désignés par une fiche (y compris chaque employé
 *      de la liste membres_ids d'un chantier), que la route vérifie comme appartenant au compte.
 * Module pur : aucune requête, aucun accès au réseau.
 */

import { z } from 'zod'
import { JOURS_MAX_PAR_CHANTIER, jourValide, lireEquipeParJour, membresDesignes } from '@/lib/btp/equipe-par-jour'

// Tables écrivables par le POST. `ref_taux` (taux de référence globaux, posés par migration) n'y figure pas :
// la route le sert seulement en lecture (`GET /api/btp?table=ref_taux`).
export const BTP_TABLES_ECRIVABLES = ['chantiers_btp', 'membres_btp', 'equipes_btp', 'pointages_btp', 'depenses_btp', 'settings_btp', 'situations_btp', 'retenues_btp', 'dc4_btp', 'dce_analyses_btp', 'dpgf_btp', 'charges_fixes', 'rapports_btp'] as const
export type TableEcrivable = typeof BTP_TABLES_ECRIVABLES[number]

/** Tables dont une autre fiche peut désigner une ligne (chantier_id, membre_id, equipe_id). */
export type TableCible = 'chantiers_btp' | 'membres_btp' | 'equipes_btp'

/** Colonnes posées par la base ou par la route, jamais par l'écran : retirées sans erreur avant tout contrôle. */
export const COLONNES_SYSTEME = ['id', 'owner_id', 'created_at', 'updated_at'] as const

/**
 * `liste_uuid` : tableau d'identifiants (colonne uuid[]), envoyé en liste JSON.
 * `equipe_jours` : objet JSON { "AAAA-MM-JJ": [identifiants] } (colonne jsonb equipe_par_jour d'un chantier).
 */
type TypeColonne = 'texte' | 'uuid' | 'liste_uuid' | 'equipe_jours' | 'nombre' | 'booleen' | 'date' | 'heure' | 'json'

export interface SpecColonne {
  type: TypeColonne
  /** NOT NULL sans valeur par défaut en production : à fournir à la création. */
  requis?: boolean
  /** NOT NULL en production : null refusé (une valeur absente prend la valeur par défaut de la base). */
  nonNul?: boolean
  /** Bornes métier, incluses (nombres seulement). */
  min?: number
  max?: number
  /** Ce que désigne la valeur, dans un message (« le budget »). */
  libelle?: string
  /**
   * La valeur (chaque élément, pour une liste) est l'identifiant d'une fiche de cette table, qui doit appartenir au
   * même compte.
   */
  cible?: TableCible
}

// ── Raccourcis ───────────────────────────────────────────────────────────────
// Les colonnes integer de la base sont décrites en « nombre » : la base tranche elle-même sur la partie décimale.
const texte: SpecColonne = { type: 'texte' }
const texteNonNul: SpecColonne = { type: 'texte', nonNul: true }
const texteRequis: SpecColonne = { type: 'texte', requis: true, nonNul: true }
const nombre: SpecColonne = { type: 'nombre' }
const date: SpecColonne = { type: 'date' }
const booleen: SpecColonne = { type: 'booleen' }
const json: SpecColonne = { type: 'json' }
const jsonNonNul: SpecColonne = { type: 'json', nonNul: true }
const positif = (libelle: string, autres: Partial<SpecColonne> = {}): SpecColonne => ({ type: 'nombre', min: 0, libelle, ...autres })
const pourcentage = (libelle: string, autres: Partial<SpecColonne> = {}): SpecColonne => ({ type: 'nombre', min: 0, max: 100, libelle, ...autres })
const latitude = (libelle: string): SpecColonne => ({ type: 'nombre', min: -90, max: 90, libelle })
const longitude = (libelle: string): SpecColonne => ({ type: 'nombre', min: -180, max: 180, libelle })
const lien = (cible: TableCible): SpecColonne => ({ type: 'uuid', cible })

/**
 * Colonnes écrivables de chaque table (relevé de production du 11/11/2026, hors COLONNES_SYSTEME).
 * Une colonne sans borne n'en a pas besoin ou relève d'un choix de produit : montant d'une dépense (un avoir
 * fournisseur peut-il être négatif ?), marge prévue, objectif de marge, numéro de situation.
 */
export const COLONNES_BTP: Record<TableEcrivable, Record<string, SpecColonne>> = {
  chantiers_btp: {
    titre: texteRequis, client: texte, adresse: texte, ville: texte, code_postal: texte,
    latitude: latitude('la latitude'), longitude: longitude('la longitude'),
    geo_rayon_m: { type: 'nombre', nonNul: true, min: 1, libelle: 'le rayon de pointage' },
    date_debut: date, date_fin: date,
    budget: positif('le budget'),
    statut: texteNonNul, description: texte, equipe: texte,
    marge_prevue_pct: nombre,
    tva_taux: pourcentage('le taux de TVA'),
    montant_facture: positif('le montant facturé'),
    acompte_recu: positif('l\'acompte reçu'),
    penalite_retard_jour: positif('la pénalité de retard par jour'),
    sous_taches: jsonNonNul,
    // Employés affectés au chantier (uuid[], vide par défaut ; migration 20261116) : chacun doit être un membre du
    // compte, comme membre_id et equipe_id ailleurs.
    membres_ids: { type: 'liste_uuid', nonNul: true, cible: 'membres_btp' },
    // Chantier soumis à l'alerte météo par notification (migration 20261126b, décision du 26/11/2026).
    alerte_meteo: { type: 'booleen', nonNul: true },
    // Équipe retouchée jour par jour ({ "AAAA-MM-JJ": [uuid…] }, objet vide par défaut ; migration 20261128c,
    // lib/btp/equipe-par-jour.ts) : chaque employé désigné doit être un membre du compte, comme dans membres_ids.
    equipe_par_jour: { type: 'equipe_jours', nonNul: true, cible: 'membres_btp' },
  },
  membres_btp: {
    prenom: texteRequis, nom: texteRequis, telephone: texte, email: texte,
    type_compte: texteNonNul, role_perso: texte,
    equipe_id: lien('equipes_btp'),
    cout_horaire: positif('le coût horaire', { nonNul: true }),
    charges_pct: pourcentage('le taux de charges', { nonNul: true }),
    salaire_brut_mensuel: positif('le salaire brut mensuel'),
    salaire_net_mensuel: positif('le salaire net mensuel'),
    charges_salariales_pct: pourcentage('le taux de charges salariales'),
    charges_patronales_pct: pourcentage('le taux de charges patronales'),
    type_contrat: texte,
    heures_hebdo: { type: 'nombre', min: 0, max: 168, libelle: 'le nombre d\'heures par semaine' },
    panier_repas_jour: positif('le panier repas'),
    indemnite_trajet_jour: positif('l\'indemnité de trajet'),
    prime_mensuelle: positif('la prime mensuelle'),
    actif: booleen,
  },
  equipes_btp: {
    nom: texteRequis, metier: texte,
    chantier_id: lien('chantiers_btp'),
  },
  pointages_btp: {
    membre_id: lien('membres_btp'),
    chantier_id: lien('chantiers_btp'),
    employe: texteRequis, poste: texte, chantier_nom: texte,
    date: { type: 'date', requis: true, nonNul: true },
    heure_arrivee: { type: 'heure', requis: true, nonNul: true },
    heure_depart: { type: 'heure' },
    pause_minutes: { type: 'nombre', nonNul: true, min: 0, max: 1440, libelle: 'la pause' },
    heures_travaillees: { type: 'nombre', min: 0, max: 24, libelle: 'les heures travaillées' },
    notes: texte,
    mode: texteNonNul,
    arrivee_lat: latitude('la latitude d\'arrivée'), arrivee_lng: longitude('la longitude d\'arrivée'),
    depart_lat: latitude('la latitude de départ'), depart_lng: longitude('la longitude de départ'),
    distance_m: positif('la distance au chantier'),
  },
  depenses_btp: {
    chantier_id: lien('chantiers_btp'),
    label: texteRequis,
    amount: { type: 'nombre', requis: true, nonNul: true },
    category: texteNonNul,
    date: { type: 'date', nonNul: true },
    notes: texte,
  },
  settings_btp: {
    depot_adresse: texte,
    depot_lat: latitude('la latitude du dépôt'), depot_lng: longitude('la longitude du dépôt'),
    depot_rayon_m: { type: 'nombre', nonNul: true, min: 1, libelle: 'le rayon du dépôt' },
    cout_horaire_ouvrier: positif('le coût horaire d\'un ouvrier', { nonNul: true }),
    cout_horaire_chef_chantier: positif('le coût horaire d\'un chef de chantier', { nonNul: true }),
    cout_horaire_conducteur: positif('le coût horaire d\'un conducteur de travaux', { nonNul: true }),
    charges_patronales_pct: pourcentage('le taux de charges patronales', { nonNul: true }),
    geo_pointage_enabled: { type: 'booleen', nonNul: true },
    devise: texteNonNul,
    salaire_patron_mensuel: positif('le salaire du dirigeant'),
    salaire_patron_type: texte, statut_juridique: texte, regime_tva: texte,
    taux_is: pourcentage('le taux d\'impôt sur les sociétés'),
    taux_cotisations_patron: positif('le taux de cotisations du dirigeant'),
    frais_fixes_mensuels: json,
    objectif_marge_pct: nombre,
    amortissements_mensuels: positif('les amortissements mensuels'),
  },
  situations_btp: {
    chantier: texteNonNul, client: texte,
    numero: { type: 'nombre', nonNul: true },
    date: { type: 'date', nonNul: true },
    montant_marche: positif('le montant du marché'),
    travaux: jsonNonNul,
    statut: texteNonNul,
    chantier_id: lien('chantiers_btp'),
  },
  retenues_btp: {
    chantier: texteNonNul, client: texte,
    montant_marche: positif('le montant du marché'),
    taux_retenue: pourcentage('le taux de retenue'),
    montant_retenu: positif('le montant retenu'),
    date_fin_travaux: date, date_liberation: date,
    statut: texteNonNul,
    caution: booleen,
    chantier_id: lien('chantiers_btp'),
  },
  dc4_btp: {
    entreprise: texteNonNul, siret: texte, responsable: texte, email: texte, telephone: texte, adresse: texte,
    chantier: texte, lot: texte,
    montant_marche: positif('le montant du marché'),
    taux_tva: pourcentage('le taux de TVA'),
    statut: texteNonNul,
    date_agrement: date,
    dc4_genere: booleen,
    chantier_id: lien('chantiers_btp'),
  },
  dce_analyses_btp: {
    titre: texteNonNul, country: texte, project_type: texte, status: texteNonNul, result: json,
  },
  dpgf_btp: {
    titre: texteNonNul, client: texte, date_remise: date,
    montant_estime: positif('le montant estimé'),
    statut: texteNonNul,
    lots: jsonNonNul,
  },
  charges_fixes: {
    label: texteRequis,
    montant: positif('le montant', { requis: true, nonNul: true }),
    frequence: texteRequis, categorie: texteRequis,
    date_debut: date, date_fin: date,
  },
  rapports_btp: {
    chantier_id: lien('chantiers_btp'),
    titre: texte, date: texte, contenu: json, photos: json, status: texte,
  },
}

// ── Types : ce que la base accepte (refuser moins large ferait échouer une saisie que la base prend) ───────────
const FORMAT_NOMBRE = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/
export const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMAS_TYPES: Record<TypeColonne, z.ZodType> = {
  texte: z.union([z.string(), z.number(), z.boolean()]),
  uuid: z.string().regex(FORMAT_UUID),
  // Seulement une liste JSON : la base lirait aussi un littéral de tableau en texte (« {…} »), mais la route doit
  // pouvoir contrôler chaque identifiant (même compte).
  liste_uuid: z.array(z.string().regex(FORMAT_UUID)),
  // Un vrai jour du calendrier par clé, une liste d'identifiants par jour, au plus JOURS_MAX_PAR_CHANTIER jours.
  equipe_jours: z.record(z.string().refine(jourValide), z.array(z.string().regex(FORMAT_UUID)))
    .refine(jours => Object.keys(jours).length <= JOURS_MAX_PAR_CHANTIER),
  nombre: z.union([z.number(), z.string().regex(FORMAT_NOMBRE)]),
  booleen: z.union([z.boolean(), z.string(), z.number()]),
  date: z.union([z.string(), z.number()]),
  heure: z.union([z.string(), z.number()]),
  json: z.unknown(),
}

export type ModeEcriture = 'creation' | 'modification' | 'reprise'

const aLaColonne = (table: TableEcrivable, colonne: string) => Object.prototype.hasOwnProperty.call(COLONNES_BTP[table], colonne)

/**
 * Colonnes, types et champs obligatoires d'une ligne déjà débarrassée des COLONNES_SYSTEME.
 * null si elle est acceptable ; sinon la raison du refus (400), qui nomme les champs en cause, sans point final
 * (« champs non reconnus (couleur) ») : la route la place dans sa phrase.
 * En modification, seuls les champs présents sont contrôlés (modification partielle).
 */
export function verifierLigne(table: TableEcrivable, ligne: Record<string, unknown>, mode: ModeEcriture): string | null {
  const colonnes = COLONNES_BTP[table]
  const inconnus = Object.keys(ligne).filter(c => !aLaColonne(table, c))
  if (inconnus.length > 0) return `champs non reconnus (${inconnus.join(', ')})`

  if (mode !== 'modification') {
    const manquants = Object.entries(colonnes).filter(([c, spec]) => spec.requis && ligne[c] === undefined).map(([c]) => c)
    if (manquants.length > 0) return `champs obligatoires manquants (${manquants.join(', ')})`
  }

  const vides = Object.entries(ligne).filter(([c, valeur]) => valeur === null && colonnes[c].nonNul).map(([c]) => c)
  if (vides.length > 0) return `ces champs ne peuvent pas être vides (${vides.join(', ')})`

  const invalides = Object.entries(ligne)
    .filter(([c, valeur]) => valeur !== null && valeur !== undefined && !SCHEMAS_TYPES[colonnes[c].type].safeParse(valeur).success)
    .map(([c]) => c)
  if (invalides.length > 0) return `valeur au mauvais format pour ${invalides.join(', ')}`
  return null
}

export interface HorsBornes { colonne: string; message: string }

function messageBornes(spec: SpecColonne, valeur: number): string {
  const sujet = `Valeur refusée pour ${spec.libelle ?? 'ce champ'} (${valeur})`
  if (spec.min !== undefined && spec.max !== undefined) return `${sujet} : elle doit être comprise entre ${spec.min} et ${spec.max}.`
  if (spec.min === 0) return `${sujet} : elle doit être positive ou nulle.`
  if (spec.min !== undefined) return `${sujet} : elle doit être au moins égale à ${spec.min}.`
  return `${sujet} : elle doit être au plus égale à ${spec.max}.`
}

/** Valeurs de la ligne hors de leurs bornes métier, avec le message à afficher. */
export function valeursHorsBornes(table: TableEcrivable, ligne: Record<string, unknown>): HorsBornes[] {
  const colonnes = COLONNES_BTP[table]
  const hors: HorsBornes[] = []
  for (const [colonne, valeur] of Object.entries(ligne)) {
    const spec = colonnes[colonne]
    if (!spec || (spec.min === undefined && spec.max === undefined) || valeur === null || valeur === undefined) continue
    const n = Number(valeur)
    if (!Number.isFinite(n)) continue
    if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
      hors.push({ colonne, message: messageBornes(spec, n) })
    }
  }
  return hors
}

export interface Reference { colonne: string; cible: TableCible; id: string }

/** Chantier, membre ou équipe désignés par la ligne (identifiants non vides ; un par élément d'une liste). */
export function referencesDeLigne(table: TableEcrivable, ligne: Record<string, unknown>): Reference[] {
  const colonnes = COLONNES_BTP[table]
  return Object.entries(ligne).flatMap(([colonne, valeur]) => {
    const spec = colonnes[colonne]
    const cible = spec?.cible
    if (!cible) return []
    const ids: unknown[] = spec.type === 'equipe_jours' ? membresDesignes(lireEquipeParJour(valeur))
      : spec.type === 'liste_uuid' && Array.isArray(valeur) ? valeur : [valeur]
    return ids.filter((id): id is string => typeof id === 'string' && id !== '').map(id => ({ colonne, cible, id }))
  })
}

/**
 * L'identifiant `id` est déjà enregistré dans cette colonne de la fiche : c'est sa valeur, un élément de sa liste
 * (membres_ids d'un chantier), ou un employé d'un de ses jours (equipe_par_jour d'un chantier, seul objet concerné).
 */
export function dejaEnregistre(id: string, valeurEnBase: unknown): boolean {
  if (Array.isArray(valeurEnBase)) return valeurEnBase.some(v => memeValeur(id, v))
  if (typeof valeurEnBase === 'object' && valeurEnBase !== null) {
    return membresDesignes(lireEquipeParJour(valeurEnBase)).some(v => memeValeur(id, v))
  }
  return memeValeur(id, valeurEnBase)
}

/** Même valeur, au sens de la base : 150 et « 150 » sont égaux, un identifiant se compare sans la casse. */
export function memeValeur(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null)
  if (typeof a === 'string' && typeof b === 'string' && FORMAT_UUID.test(a) && FORMAT_UUID.test(b)) {
    return a.toLowerCase() === b.toLowerCase()
  }
  const na = typeof a === 'string' && a.trim() === '' ? NaN : Number(a)
  const nb = typeof b === 'string' && b.trim() === '' ? NaN : Number(b)
  if (typeof a !== 'object' && typeof b !== 'object' && Number.isFinite(na) && Number.isFinite(nb)) return na === nb
  return JSON.stringify(a) === JSON.stringify(b)
}
