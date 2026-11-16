'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { jetonAcces } from '@/lib/auth/jeton-acces'
import { lireSessionSure } from '@/lib/auth/session-navigateur'
import { resolveCompanyType } from '@/lib/config/companyTypes'
import { RAYON_PAR_DEFAUT_M } from '@/lib/btp/pointage-geo'

function safeJsonParse(val: unknown, fallback: any = []) {
  if (typeof val !== 'string') return val || fallback
  try { return JSON.parse(val) } catch { return fallback }
}

/** Rayon du pointage GPS saisi : entier positif, sinon la valeur par défaut de la colonne geo_rayon_m. */
function rayonSaisi(valeur: unknown): number {
  const nombre = typeof valeur === 'string' ? Number(valeur) : valeur
  return typeof nombre === 'number' && Number.isFinite(nombre) && nombre > 0 ? Math.round(nombre) : RAYON_PAR_DEFAUT_M
}

/** Identifiants d'une liste (chaînes non vides, sans doublon) ; liste vide pour toute autre valeur. */
function identifiants(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return []
  return [...new Set(valeur.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Colonnes de clé que mapToSupabase écrit depuis le pointage géolocalisé (16/11/2026), par table. */
const CLES_DU_POINTAGE: Partial<Record<ShortName, readonly string[]>> = {
  chantiers: ['membres_ids'],
  equipes: ['chantier_id'],
  pointages: ['membre_id', 'chantier_id'],
}

/**
 * Ligne importée depuis le localStorage : un ancien identifiant local (« demo-ch-001 », horodatage) dans une de ces
 * colonnes ferait échouer tout le lot sur le type uuid ; il est retiré (null, ou sorti de la liste), la ligne passe.
 * Les autres colonnes et les autres tables sont importées comme avant.
 */
export function ligneImportable(table: ShortName, ligne: Record<string, unknown>): Record<string, unknown> {
  const propre: Record<string, unknown> = { ...ligne }
  for (const colonne of CLES_DU_POINTAGE[table] ?? []) {
    const valeur = propre[colonne]
    if (Array.isArray(valeur)) propre[colonne] = valeur.filter(id => typeof id === 'string' && FORME_UUID.test(id))
    else if (typeof valeur === 'string' && !FORME_UUID.test(valeur)) propre[colonne] = null
  }
  return propre
}

// ═══════════════════════════════════════════════════════════════════════════════
// useBTPData — Hook universel pour les données BTP
// Remplace localStorage par Supabase, avec import automatique des données
// existantes au premier chargement.
// ═══════════════════════════════════════════════════════════════════════════════

// Jeton tenu à jour par les événements d'auth (lib/auth/jeton-acces.ts) : pas de getSession() à chaque fetch,
// donc pas de prise du verrou d'auth partagé entre onglets (lot 1 Sentry du 28/10/2026).
async function authHeaders(): Promise<Record<string, string>> {
  const token = await jetonAcces()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type TableName = 'chantiers_btp' | 'membres_btp' | 'equipes_btp' | 'pointages_btp' | 'depenses_btp' | 'situations_btp' | 'retenues_btp' | 'dc4_btp' | 'dce_analyses_btp' | 'dpgf_btp' | 'charges_fixes' | 'rapports_btp'
type ShortName = 'chantiers' | 'membres' | 'equipes' | 'pointages' | 'depenses' | 'situations' | 'retenues' | 'dc4' | 'dce_analyses' | 'dpgf' | 'charges_fixes' | 'rapports'

const TABLE_MAP: Record<ShortName, TableName> = {
  chantiers: 'chantiers_btp',
  membres: 'membres_btp',
  equipes: 'equipes_btp',
  pointages: 'pointages_btp',
  depenses: 'depenses_btp',
  situations: 'situations_btp',
  retenues: 'retenues_btp',
  dc4: 'dc4_btp',
  dce_analyses: 'dce_analyses_btp',
  dpgf: 'dpgf_btp',
  charges_fixes: 'charges_fixes',
  rapports: 'rapports_btp',
}

// localStorage keys to check for import
const LS_KEYS: Record<ShortName, (id: string) => string> = {
  chantiers: (id) => `fixit_chantiers_${id}`,
  membres: (id) => `fixit_membres_${id}`,
  equipes: (id) => `fixit_equipes_btp_${id}`,
  pointages: (id) => `pointage_${id}`,
  depenses: (id) => `fixit_expenses_${id}`,
  situations: (id) => `situations_${id}`,
  retenues: (id) => `retenues_${id}`,
  dc4: (id) => `dc4_${id}`,
  dce_analyses: (id) => `dce_analyses_${id}`,
  dpgf: (id) => `dpgf_${id}`,
  charges_fixes: (id) => `charges_fixes_${id}`,
  rapports: (id) => `fixit_rapports_${id}`,
}

// Map localStorage fields → Supabase columns
// Sert aux CRÉATIONS : tout champ absent reçoit une valeur par défaut. Pour une modification, passer par
// colonnesModifiees() plus bas, qui n'envoie que les champs réellement fournis.
export function mapToSupabase(table: ShortName, item: any): any {
  switch (table) {
    case 'chantiers': {
      const mapped: Record<string, unknown> = {
        titre: item.titre || '',
        client: item.client || null,
        adresse: item.adresse || null,
        ville: item.ville || null,
        code_postal: item.codePostal || item.code_postal || null,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        date_debut: item.dateDebut || null,
        date_fin: item.dateFin || null,
        budget: item.budget ? parseFloat(item.budget) : null,
        statut: item.statut || 'En attente',
        description: item.description || null,
        equipe: item.equipe || null,
      }
      // sous_taches is a partial-update field — only include when explicitly provided
      if ('sous_taches' in item) mapped.sous_taches = item.sous_taches
      else if ('sousTaches' in item) mapped.sous_taches = item.sousTaches
      // Rayon du pointage GPS et employés affectés : seulement quand le formulaire les fournit (fiche chantier,
      // écran Pointage). Sans la colonne membres_ids (migration 20261116), /api/btp enregistre le reste du chantier.
      if ('geoRayonM' in item) mapped.geo_rayon_m = rayonSaisi(item.geoRayonM)
      else if ('geo_rayon_m' in item) mapped.geo_rayon_m = rayonSaisi(item.geo_rayon_m)
      if ('membres_ids' in item) mapped.membres_ids = identifiants(item.membres_ids)
      return mapped
    }
    case 'membres':
      return {
        prenom: item.prenom || '',
        nom: item.nom || '',
        telephone: item.telephone || null,
        email: item.email || null,
        type_compte: item.typeCompte || 'ouvrier',
        role_perso: item.rolePerso || null,
        cout_horaire: item.coutHoraire ?? null,
        charges_pct: item.chargesPct ?? null,
        salaire_brut_mensuel: item.salaire_brut_mensuel ?? null,
        salaire_net_mensuel: item.salaire_net_mensuel ?? null,
        charges_salariales_pct: item.charges_salariales_pct ?? null,
        charges_patronales_pct: item.charges_patronales_pct ?? null,
        type_contrat: item.type_contrat || null,
        heures_hebdo: item.heures_hebdo ?? null,
        panier_repas_jour: item.panier_repas_jour ?? null,
        indemnite_trajet_jour: item.indemnite_trajet_jour ?? null,
        prime_mensuelle: item.prime_mensuelle ?? null,
        actif: item.actif ?? true,
      }
    case 'equipes':
      return {
        nom: item.nom || '',
        metier: item.metier || null,
        chantier_id: item.chantierId || item.chantier_id || null,
        membreIds: item.membreIds || [], // handled separately in API
      }
    case 'pointages':
      return {
        employe: item.employe || '',
        poste: item.poste || null,
        membre_id: item.membreId || null,
        chantier_id: item.chantierId || null,
        chantier_nom: item.chantier || null,
        date: item.date || new Date().toISOString().split('T')[0],
        heure_arrivee: item.heureArrivee || '08:00',
        heure_depart: item.heureDepart || '17:00',
        pause_minutes: item.pauseMinutes ?? 60,
        heures_travaillees: item.heuresTravaillees ?? 0,
        notes: item.notes || null,
        mode: 'manuel',
      }
    case 'depenses':
      return {
        label: item.label || '',
        amount: typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : item.amount || 0,
        category: item.category || 'autre',
        date: item.date || new Date().toISOString().split('T')[0],
        notes: item.notes || null,
      }
    case 'situations':
      return {
        chantier_id: item.chantier_id || null,
        chantier: item.chantier || '',
        client: item.client || '',
        numero: item.numero || 1,
        date: item.date || new Date().toISOString().split('T')[0],
        montant_marche: item.montantMarche ?? item.montant_marche ?? 0,
        travaux: JSON.stringify(item.travaux || []),
        statut: item.statut || 'brouillon',
      }
    case 'retenues':
      return {
        chantier_id: item.chantier_id || null,
        chantier: item.chantier || '',
        client: item.client || '',
        montant_marche: item.montantMarche ?? item.montant_marche ?? 0,
        taux_retenue: item.tauxRetenue ?? item.taux_retenue ?? 5,
        montant_retenu: item.montantRetenu ?? item.montant_retenu ?? 0,
        date_fin_travaux: item.dateFinTravaux || item.date_fin_travaux || null,
        date_liberation: item.dateLiberation || item.date_liberation || null,
        statut: item.statut || 'active',
        caution: item.caution ?? false,
      }
    case 'dc4':
      return {
        chantier_id: item.chantier_id || null,
        entreprise: item.entreprise || '',
        siret: item.siret || '',
        responsable: item.responsable || '',
        email: item.email || '',
        telephone: item.telephone || '',
        adresse: item.adresse || '',
        chantier: item.chantier || '',
        lot: item.lot || '',
        montant_marche: item.montantMarche ?? item.montant_marche ?? 0,
        taux_tva: item.tauxTVA ?? item.taux_tva ?? 20,
        statut: item.statut || 'en_attente',
        date_agrement: item.dateAgrement || item.date_agrement || null,
        dc4_genere: item.dc4Genere ?? item.dc4_genere ?? false,
      }
    case 'dce_analyses':
      return {
        titre: item.titre || '',
        country: item.country || 'FR',
        project_type: item.projectType || item.project_type || '',
        status: item.status || 'pending',
        result: typeof item.result === 'string' ? item.result : JSON.stringify(item.result || {}),
      }
    case 'dpgf':
      return {
        titre: item.titre || '',
        client: item.client || '',
        date_remise: item.dateRemise || item.date_remise || null,
        montant_estime: item.montantEstime ?? item.montant_estime ?? 0,
        statut: item.statut || 'en_cours',
        lots: JSON.stringify(item.lots || []),
      }
    case 'rapports':
      return {
        titre: item.rapportNumber || item.titre || '',
        date: item.interventionDate || item.date || new Date().toISOString().split('T')[0],
        chantier_id: item.chantier_id || null,
        contenu: (() => {
          // Store the full RapportIntervention payload as JSONB (minus fields promoted to columns)
          const { id: _id, created_at: _ca, owner_id: _oid, chantier_id: _cid, titre: _t, date: _d, photos: _ph, status: _st, ...rest } = item
          return rest
        })(),
        photos: item.linkedPhotoIds || item.photos || [],
        status: item.status || item.statut || 'brouillon',
      }
    default:
      return item
  }
}

// Champs du formulaire qui alimentent chaque colonne — mêmes correspondances que mapToSupabase ci-dessus
// (tests/lib/use-btp-data-modification-partielle.test.tsx vérifie que les deux restent alignés).
// Une colonne absente de cette table (pointages.mode, posé d'office à la création) n'est jamais réécrite par
// une modification. `rapports` n'y figure pas : son contenu regroupe tous les champs restants.
export const SOURCES_DES_COLONNES: Partial<Record<ShortName, Record<string, readonly string[]>>> = {
  chantiers: {
    titre: ['titre'], client: ['client'], adresse: ['adresse'], ville: ['ville'], code_postal: ['codePostal', 'code_postal'],
    latitude: ['latitude'], longitude: ['longitude'], date_debut: ['dateDebut'], date_fin: ['dateFin'], budget: ['budget'],
    statut: ['statut'], description: ['description'], equipe: ['equipe'], sous_taches: ['sous_taches', 'sousTaches'],
    geo_rayon_m: ['geoRayonM', 'geo_rayon_m'], membres_ids: ['membres_ids'],
  },
  membres: {
    prenom: ['prenom'], nom: ['nom'], telephone: ['telephone'], email: ['email'], type_compte: ['typeCompte'],
    role_perso: ['rolePerso'], cout_horaire: ['coutHoraire'], charges_pct: ['chargesPct'],
    salaire_brut_mensuel: ['salaire_brut_mensuel'], salaire_net_mensuel: ['salaire_net_mensuel'],
    charges_salariales_pct: ['charges_salariales_pct'], charges_patronales_pct: ['charges_patronales_pct'],
    type_contrat: ['type_contrat'], heures_hebdo: ['heures_hebdo'], panier_repas_jour: ['panier_repas_jour'],
    indemnite_trajet_jour: ['indemnite_trajet_jour'], prime_mensuelle: ['prime_mensuelle'], actif: ['actif'],
  },
  equipes: { nom: ['nom'], metier: ['metier'], chantier_id: ['chantierId', 'chantier_id'], membreIds: ['membreIds'] },
  pointages: {
    employe: ['employe'], poste: ['poste'], membre_id: ['membreId'], chantier_id: ['chantierId'],
    chantier_nom: ['chantier'], date: ['date'], heure_arrivee: ['heureArrivee'],
    heure_depart: ['heureDepart'], pause_minutes: ['pauseMinutes'], heures_travaillees: ['heuresTravaillees'], notes: ['notes'],
  },
  depenses: { label: ['label'], amount: ['amount'], category: ['category'], date: ['date'], notes: ['notes'] },
  situations: {
    chantier_id: ['chantier_id'], chantier: ['chantier'], client: ['client'], numero: ['numero'], date: ['date'],
    montant_marche: ['montantMarche', 'montant_marche'], travaux: ['travaux'], statut: ['statut'],
  },
  retenues: {
    chantier_id: ['chantier_id'], chantier: ['chantier'], client: ['client'], montant_marche: ['montantMarche', 'montant_marche'],
    taux_retenue: ['tauxRetenue', 'taux_retenue'], montant_retenu: ['montantRetenu', 'montant_retenu'],
    date_fin_travaux: ['dateFinTravaux', 'date_fin_travaux'], date_liberation: ['dateLiberation', 'date_liberation'],
    statut: ['statut'], caution: ['caution'],
  },
  dc4: {
    chantier_id: ['chantier_id'], entreprise: ['entreprise'], siret: ['siret'], responsable: ['responsable'], email: ['email'],
    telephone: ['telephone'], adresse: ['adresse'], chantier: ['chantier'], lot: ['lot'],
    montant_marche: ['montantMarche', 'montant_marche'], taux_tva: ['tauxTVA', 'taux_tva'], statut: ['statut'],
    date_agrement: ['dateAgrement', 'date_agrement'], dc4_genere: ['dc4Genere', 'dc4_genere'],
  },
  dce_analyses: {
    titre: ['titre'], country: ['country'], project_type: ['projectType', 'project_type'], status: ['status'], result: ['result'],
  },
  dpgf: {
    titre: ['titre'], client: ['client'], date_remise: ['dateRemise', 'date_remise'],
    montant_estime: ['montantEstime', 'montant_estime'], statut: ['statut'], lots: ['lots'],
  },
}

/**
 * Colonnes à écrire pour une MODIFICATION : seulement celles dont le formulaire a fourni un champ.
 *
 * mapToSupabase donne une valeur par défaut à tout champ absent (titre '', client null, statut « En attente »…),
 * ce qui est juste pour une création et destructeur pour une modification partielle : changer le statut d'un
 * chantier, le prolonger, ajouter un poste à une situation ou enregistrer des coordonnées (page Météo) réécrivait
 * à vide tous les autres champs de la fiche (audit des fondations BTP du 11/11/2026).
 * Un champ présent dans `changes`, même vide ou undefined, est écrit : un formulaire complet vide ainsi un champ
 * comme avant.
 */
export function colonnesModifiees(table: ShortName, changes: Record<string, unknown>): Record<string, unknown> {
  const complet = mapToSupabase(table, changes) as Record<string, unknown>
  const sources = SOURCES_DES_COLONNES[table]
  if (!sources) return complet
  return Object.fromEntries(
    Object.entries(complet).filter(([colonne]) => (sources[colonne] ?? []).some(champ => champ in changes)),
  )
}

// Map Supabase columns → component-friendly format (keeps both formats for compat)
function mapFromSupabase(table: ShortName, item: any): any {
  switch (table) {
    case 'chantiers':
      return {
        ...item,
        titre: item.titre,
        client: item.client || '',
        adresse: item.adresse || '',
        ville: item.ville || '',
        codePostal: item.code_postal || '',
        dateDebut: item.date_debut || '',
        dateFin: item.date_fin || '',
        budget: item.budget ? String(item.budget) : '',
        statut: item.statut,
        description: item.description || '',
        equipe: item.equipe || '',
        createdAt: item.created_at,
        geoRayonM: item.geo_rayon_m || 100,
        latitude: item.latitude,
        longitude: item.longitude,
        sousTaches: Array.isArray(item.sous_taches) ? item.sous_taches : [],
      }
    case 'membres':
      return {
        ...item,
        prenom: item.prenom,
        nom: item.nom,
        telephone: item.telephone || '',
        email: item.email || '',
        typeCompte: item.type_compte,
        rolePerso: item.role_perso || '',
        equipeId: item.equipe_id || '',
        coutHoraire: item.cout_horaire || 25,
        chargesPct: item.charges_pct || 45,
        salaire_brut_mensuel: item.salaire_brut_mensuel,
        salaire_net_mensuel: item.salaire_net_mensuel,
        charges_salariales_pct: item.charges_salariales_pct ?? 22,
        charges_patronales_pct: item.charges_patronales_pct ?? 45,
        type_contrat: item.type_contrat || 'cdi',
        heures_hebdo: item.heures_hebdo || 35,
        panier_repas_jour: item.panier_repas_jour || 0,
        indemnite_trajet_jour: item.indemnite_trajet_jour || 0,
        prime_mensuelle: item.prime_mensuelle || 0,
        actif: item.actif !== false,
        createdAt: item.created_at,
      }
    case 'equipes':
      return {
        ...item,
        nom: item.nom,
        metier: item.metier || '',
        chantierId: item.chantier_id || '',
        membreIds: item.membreIds || [],
        createdAt: item.created_at,
      }
    case 'pointages':
      return {
        ...item,
        employe: item.employe,
        poste: item.poste || '',
        membreId: item.membre_id || '',
        chantierId: item.chantier_id || '',
        chantier: item.chantier_nom || '',
        date: item.date,
        heureArrivee: item.heure_arrivee,
        heureDepart: item.heure_depart || '',
        pauseMinutes: item.pause_minutes,
        heuresTravaillees: parseFloat(item.heures_travaillees) || 0,
        notes: item.notes || '',
        mode: item.mode || 'manuel',
        arriveeLat: item.arrivee_lat,
        arriveeLng: item.arrivee_lng,
        distanceM: item.distance_m,
      }
    case 'depenses':
      return {
        ...item,
        label: item.label,
        amount: item.amount,
        category: item.category,
        date: item.date,
        notes: item.notes || '',
        chantierId: item.chantier_id,
      }
    case 'situations':
      return {
        ...item,
        chantier_id: item.chantier_id || '',
        chantier: item.chantier,
        client: item.client || '',
        numero: item.numero,
        date: item.date,
        montantMarche: item.montant_marche || 0,
        travaux: safeJsonParse(item.travaux, []),
        statut: item.statut,
      }
    case 'retenues':
      return {
        ...item,
        chantier_id: item.chantier_id || '',
        chantier: item.chantier,
        client: item.client || '',
        montantMarche: item.montant_marche || 0,
        tauxRetenue: item.taux_retenue || 5,
        montantRetenu: item.montant_retenu || 0,
        dateFinTravaux: item.date_fin_travaux || '',
        dateLiberation: item.date_liberation || '',
        statut: item.statut,
        caution: item.caution ?? false,
      }
    case 'dc4':
      return {
        ...item,
        chantier_id: item.chantier_id || '',
        entreprise: item.entreprise,
        siret: item.siret || '',
        responsable: item.responsable || '',
        email: item.email || '',
        telephone: item.telephone || '',
        adresse: item.adresse || '',
        chantier: item.chantier || '',
        lot: item.lot || '',
        montantMarche: item.montant_marche || 0,
        tauxTVA: item.taux_tva || 20,
        statut: item.statut,
        dateAgrement: item.date_agrement || '',
        dc4Genere: item.dc4_genere ?? false,
      }
    case 'dce_analyses':
      return {
        ...item,
        titre: item.titre,
        country: item.country || 'FR',
        projectType: item.project_type || '',
        createdAt: item.created_at,
        status: item.status,
        result: safeJsonParse(item.result, {}),
      }
    case 'dpgf':
      return {
        ...item,
        titre: item.titre,
        client: item.client || '',
        dateRemise: item.date_remise || '',
        montantEstime: item.montant_estime || 0,
        statut: item.statut,
        lots: safeJsonParse(item.lots, []),
      }
    case 'rapports': {
      // Reconstruct the full RapportIntervention shape from JSONB contenu + promoted columns
      const contenu = safeJsonParse(item.contenu, {})
      return {
        ...contenu,
        id: item.id,
        created_at: item.created_at,
        chantier_id: item.chantier_id || null,
        rapportNumber: item.titre || contenu.rapportNumber || '',
        interventionDate: item.date || contenu.interventionDate || '',
        linkedPhotoIds: Array.isArray(item.photos) ? item.photos : safeJsonParse(item.photos, []),
        status: item.status || contenu.status || 'brouillon',
      }
    }
    default:
      return item
  }
}

// ── In-memory cache to avoid re-fetching on every tab switch ──
const _dataCache: Record<string, { data: any[]; at: number }> = {}
const DATA_CACHE_TTL = 300_000 // 5 min — BTP data rarely changes mid-session

// ── Requêtes en vol partagées : le préchargement et les sections qui montent juste après demandaient les mêmes
// tables en double (lot 8 Sentry du 28/10/2026 : chantiers, membres, situations deux fois au chargement).
const _enVol: Record<string, { generation: number; promesse: Promise<any[] | null> }> = {}

// ── Génération par clé de table, incrémentée à chaque écriture confirmée (ajout, modification, suppression,
// import) : un GET parti avant l'écriture peut renvoyer l'état d'avant (pointage supprimé encore affiché).
const _generations: Record<string, number> = {}

function generationActuelle(cacheKey: string): number {
  return _generations[cacheKey] ?? 0
}

function marquerEcriture(cacheKey: string): void {
  _generations[cacheKey] = generationActuelle(cacheKey) + 1
}

/** GET d'une table : lignes brutes, null si la réponse n'est pas ok. */
async function lireTable(table: ShortName): Promise<unknown[] | null> {
  const res = await fetch(`/api/btp?table=${table}`, { headers: await authHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  return json[table] || []
}

/**
 * Charge une table, remplit le cache ; null si la réponse n'est pas ok. Les chargements d'une même génération
 * partagent une seule requête. Une réponse arrivée après une écriture (génération dépassée) ne remplit ni le cache
 * ni la liste : ses appelants reçoivent le chargement de la génération courante (requête en vol réutilisée, ou
 * nouvelle si elle est déjà terminée).
 */
function chargerTable(table: ShortName, cacheKey: string): Promise<any[] | null> {
  const generation = generationActuelle(cacheKey)
  const enCours = _enVol[cacheKey]
  if (enCours?.generation === generation) return enCours.promesse
  const promesse = (async (): Promise<any[] | null> => {
    let raw: any[] | null = null
    try {
      raw = await lireTable(table)
    } catch (err) {
      if (generationActuelle(cacheKey) !== generation) return chargerTable(table, cacheKey)
      throw err
    } finally {
      // Une requête d'une génération plus récente a pu prendre la place : elle reste partagée.
      if (_enVol[cacheKey]?.generation === generation) delete _enVol[cacheKey]
    }
    if (generationActuelle(cacheKey) !== generation) return chargerTable(table, cacheKey)
    if (raw !== null) _dataCache[cacheKey] = { data: raw.map((r: any) => mapFromSupabase(table, r)), at: Date.now() }
    return raw
  })()
  _enVol[cacheKey] = { generation, promesse }
  return promesse
}

// ── Prefetch multiple tables in parallel to fill cache before components mount ──
export async function prefetchBTPTables(tables: ShortName[], userId: string) {
  await Promise.all(
    tables.map(async (table) => {
      const cacheKey = `${table}_${userId}`
      if (_dataCache[cacheKey] && Date.now() - _dataCache[cacheKey].at < DATA_CACHE_TTL) return
      try {
        await chargerTable(table, cacheKey)
      } catch (err) { console.warn(`[btp] prefetch ${table} failed:`, err) }
    })
  )
}

interface UseBTPDataOptions {
  table: ShortName
  artisanId: string  // for localStorage import key
  userId: string     // Supabase auth user id
  autoImport?: boolean // import localStorage data on first load (default: true)
}

export function useBTPData<T = any>({ table, artisanId, userId, autoImport = true }: UseBTPDataOptions) {
  const cacheKey = `${table}_${userId}`
  const cached = _dataCache[cacheKey]
  const hasFreshCache = cached && (Date.now() - cached.at < DATA_CACHE_TTL)
  const hasAnyCache = !!cached?.data

  // Use stale cache as initial data — user sees content instantly, refresh runs in background
  const [items, setItems] = useState<T[]>(hasAnyCache ? cached.data : [])
  const [loading, setLoading] = useState(!hasAnyCache)
  const [error, setError] = useState<string | null>(null)
  const imported = useRef(false)

  const tableName = TABLE_MAP[table]

  // ── Fetch from Supabase ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      // Requête partagée avec le préchargement et les autres sections (une seule par table en vol, sauf après une
      // écriture : voir chargerTable).
      const raw = await chargerTable(table, cacheKey)
      if (raw === null) throw new Error('Fetch failed')
      setItems(_dataCache[cacheKey]?.data ?? raw.map((r: any) => mapFromSupabase(table, r)))
      setError(null)
      return raw
    } catch (err) {
      console.warn(`[btp] refresh ${table} failed:`, err)
      setError('Erreur de chargement')
      return null // null = erreur réseau (distinct de [] = table vide)
    } finally {
      setLoading(false)
    }
  }, [table, cacheKey])

  // ── Auto-import from localStorage on first load ─────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      // Skip fetch if cache is fresh — data was already set in useState
      if (hasFreshCache) {
        setLoading(false)
        return
      }

      // Stale cache: show cached data immediately, refresh in background (no loading spinner)
      if (hasAnyCache) {
        setLoading(false)
      }

      const data = await refresh()

      // If Supabase is empty and localStorage has data → import (skip if refresh failed)
      if (autoImport && !imported.current && data !== null && data.length === 0 && artisanId) {
        const lsKey = LS_KEYS[table](artisanId)
        try {
          const raw = localStorage.getItem(lsKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              imported.current = true
              const mapped = parsed.map((item: any) => ligneImportable(table, mapToSupabase(table, item)))

              const res = await fetch('/api/btp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await authHeaders() },
                body: JSON.stringify({ table: tableName, action: 'import', data: mapped }),
              })

              if (res.ok) {
                // Mark as imported in localStorage
                localStorage.setItem(`${lsKey}_migrated`, 'true')
                marquerEcriture(cacheKey)
                if (!cancelled) await refresh()
              }
            }
          }
        } catch { /* silent */ }
      }
    }

    init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, artisanId, autoImport, tableName])

  // ── CRUD operations ─────────────────────────────────────────────────────

  const add = useCallback(async (item: Partial<T>): Promise<T | null> => {
    try {
      const mapped = mapToSupabase(table, item)
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: tableName, action: 'insert', data: mapped }),
      })
      if (!res.ok) throw new Error(`Insert ${tableName} failed: ${res.status}`)
      // Écriture confirmée : refresh ne réutilise pas un GET parti avant elle.
      marquerEcriture(cacheKey)
      const json = await res.json()
      await refresh()
      return json.row ? mapFromSupabase(table, json.row) : null
    } catch (err) {
      console.error(`[btp] add ${tableName}:`, err)
      setError('Erreur lors de la création')
      return null
    }
  }, [table, tableName, cacheKey, refresh])

  const update = useCallback(async (id: string, changes: Partial<T>): Promise<boolean> => {
    try {
      // Seuls les champs fournis partent : une modification partielle ne réécrit pas le reste de la fiche.
      const mapped = colonnesModifiees(table, changes as Record<string, unknown>)
      if (Object.keys(mapped).length === 0) {
        // Rien d'enregistrable : rien ne part et rien n'est écrasé. La trace aide à repérer un champ de formulaire
        // qui n'a pas (encore) de colonne dans mapToSupabase.
        console.warn(`[btp] update ${tableName} : aucun champ enregistrable parmi`, Object.keys(changes))
        return true
      }
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: tableName, action: 'update', id, data: mapped }),
      })
      if (!res.ok) throw new Error(`Update ${tableName} failed: ${res.status}`)
      marquerEcriture(cacheKey)
      await refresh()
      return true
    } catch (err) {
      console.error(`[btp] update ${tableName}:`, err)
      setError('Erreur lors de la mise à jour')
      return false
    }
  }, [table, tableName, cacheKey, refresh])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: tableName, action: 'delete', id }),
      })
      if (!res.ok) throw new Error(`Delete ${tableName} failed: ${res.status}`)
      marquerEcriture(cacheKey)
      await refresh()
      return true
    } catch (err) {
      console.error(`[btp] remove ${tableName}:`, err)
      setError('Erreur lors de la suppression')
      return false
    }
  }, [tableName, cacheKey, refresh])

  return { items, loading, error, refresh, add, update, remove }
}

// ── Settings hook ─────────────────────────────────────────────────────────────

export interface FraiFixe {
  label: string
  montant: number
  frequence: 'mensuel' | 'annuel'
}

export interface BTPSettings {
  // Pays et type de société (payroll engine)
  country: 'FR' | 'PT'
  company_type: string
  depot_adresse?: string
  depot_lat?: number
  depot_lng?: number
  depot_rayon_m: number
  cout_horaire_ouvrier: number
  cout_horaire_chef_chantier: number
  cout_horaire_conducteur: number
  charges_patronales_pct: number
  geo_pointage_enabled: boolean
  devise: string
  // Profil patron
  salaire_patron_mensuel: number
  salaire_patron_type: 'net' | 'brut'
  taux_cotisations_patron: number
  // Situation fiscale
  statut_juridique: string
  regime_tva: string
  taux_is: number
  // Frais fixes
  frais_fixes_mensuels: FraiFixe[]
  // Objectifs
  objectif_marge_pct: number
  amortissements_mensuels: number
}

const DEFAULT_SETTINGS_FR: BTPSettings = {
  country: 'FR',
  company_type: 'sarl',
  depot_rayon_m: 100,
  cout_horaire_ouvrier: 22,
  cout_horaire_chef_chantier: 30,
  cout_horaire_conducteur: 40,
  charges_patronales_pct: 45,
  geo_pointage_enabled: false,
  devise: 'EUR',
  salaire_patron_mensuel: 0,
  salaire_patron_type: 'net',
  taux_cotisations_patron: 45,
  statut_juridique: 'sarl',
  regime_tva: 'reel_normal',
  taux_is: 25,
  frais_fixes_mensuels: [],
  objectif_marge_pct: 20,
  amortissements_mensuels: 0,
}

const DEFAULT_SETTINGS_PT: BTPSettings = {
  country: 'PT',
  company_type: 'lda',
  depot_rayon_m: 100,
  cout_horaire_ouvrier: 10,
  cout_horaire_chef_chantier: 16,
  cout_horaire_conducteur: 22,
  charges_patronales_pct: 24,
  geo_pointage_enabled: false,
  devise: 'EUR',
  salaire_patron_mensuel: 0,
  salaire_patron_type: 'net',
  taux_cotisations_patron: 24,
  statut_juridique: 'lda',
  regime_tva: 'reel_normal',
  taux_is: 21,
  frais_fixes_mensuels: [],
  objectif_marge_pct: 20,
  amortissements_mensuels: 0,
}

function getDefaultSettings(): BTPSettings {
  if (typeof document !== 'undefined') {
    const locale = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)?.[1]
    if (locale === 'pt') return DEFAULT_SETTINGS_PT
  }
  return DEFAULT_SETTINGS_FR
}

// Settings cache
let _settingsCache: { data: BTPSettings; at: number } | null = null
const SETTINGS_CACHE_TTL = 300_000 // 5 min

export function useBTPSettings() {
  const hasFresh = _settingsCache && (Date.now() - _settingsCache.at < SETTINGS_CACHE_TTL)
  const [settings, setSettings] = useState<BTPSettings>(hasFresh ? _settingsCache!.data : getDefaultSettings())
  const [loading, setLoading] = useState(!hasFresh)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/btp?table=settings', { headers: await authHeaders() })
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (json.settings) {
        const defaults = getDefaultSettings()
        const merged = { ...defaults, ...json.settings }
        // Si le locale est PT mais les settings indiquent FR, corriger automatiquement
        if (typeof document !== 'undefined') {
          const locale = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)?.[1]
          if (locale === 'pt' && merged.country === 'FR') {
            merged.country = 'PT'
            merged.company_type = merged.company_type === 'sarl' ? 'lda' : merged.company_type
            merged.statut_juridique = merged.statut_juridique === 'sarl' ? 'lda' : merged.statut_juridique
            const ptConfig = resolveCompanyType(merged.company_type, 'PT')
            merged.charges_patronales_pct = Math.round(ptConfig.employer_charge_rate * 100)
            merged.taux_cotisations_patron = Math.round(ptConfig.boss_charge_rate * 100)
            merged.taux_is = Math.round(ptConfig.default_taux_is * 100)
          }
        }
        setSettings(merged)
        _settingsCache = { data: merged, at: Date.now() }
      } else {
        // No saved settings yet — try to initialize from user_metadata.legal_structure
        try {
          // user_metadata est dans la session locale : pas d'aller-retour réseau ni de getUser() ici.
          const { session } = await lireSessionSure(supabase.auth)
          const user = session?.user
          const legalStructure = user?.user_metadata?.legal_structure
          const country = user?.user_metadata?.country === 'PT' ? 'PT' as const : 'FR' as const
          if (legalStructure) {
            const config = resolveCompanyType(legalStructure, country)
            setSettings(prev => ({
              ...prev,
              country,
              company_type: legalStructure,
              statut_juridique: legalStructure,
              employer_charge_rate: config.employer_charge_rate,
              charges_patronales_pct: Math.round(config.employer_charge_rate * 100),
              taux_cotisations_patron: Math.round(config.boss_charge_rate * 100),
              taux_is: Math.round(config.default_taux_is * 100),
            }))
          }
        } catch { /* fallback to defaults */ }
      }
    } catch { /* use defaults */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (_settingsCache && Date.now() - _settingsCache.at < SETTINGS_CACHE_TTL) {
      setLoading(false)
      return
    }
    refresh()
  }, [refresh])

  const save = useCallback(async (changes: Partial<BTPSettings>) => {
    const prev = settings
    const updated = { ...settings, ...changes }
    setSettings(updated)
    _settingsCache = { data: updated, at: Date.now() }
    try {
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: 'settings_btp', action: 'upsert_settings', data: changes }),
      })
      if (!res.ok) throw new Error(`Settings save failed: ${res.status}`)
    } catch (err) {
      console.error('[btp] settings save failed, rolling back:', err)
      setSettings(prev)
      _settingsCache = { data: prev, at: Date.now() }
    }
  }, [settings])

  return { settings, loading, save, refresh }
}

// ── Charges fixes hook ────────────────────────────────────────────────────────

export function useChargesFixes({ artisanId, userId }: { artisanId: string; userId: string }) {
  return useBTPData<{ id: string; owner_id: string; categorie: string; label: string; montant: number; frequence: string; [key: string]: unknown }>({
    table: 'charges_fixes',
    artisanId,
    userId,
    autoImport: false,
  })
}
