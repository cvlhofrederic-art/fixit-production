'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveCompanyType } from '@/lib/config/companyTypes'

function safeJsonParse(val: unknown, fallback: any = []) {
  if (typeof val !== 'string') return val || fallback
  try { return JSON.parse(val) } catch { return fallback }
}

// ═══════════════════════════════════════════════════════════════════════════════
// useBTPData — Hook universel pour les données BTP
// Remplace localStorage par Supabase, avec import automatique des données
// existantes au premier chargement.
// ═══════════════════════════════════════════════════════════════════════════════

// Cache le token auth pour éviter un getSession() à chaque fetch
let _cachedToken: string | null = null
let _cachedAt = 0
const TOKEN_TTL = 120_000 // 2 min cache

async function authHeaders(): Promise<Record<string, string>> {
  const now = Date.now()
  if (_cachedToken && now - _cachedAt < TOKEN_TTL) {
    return { Authorization: `Bearer ${_cachedToken}` }
  }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (token) {
    _cachedToken = token
    _cachedAt = now
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

// Invalider le cache quand la session change (login/logout)
supabase.auth.onAuthStateChange(() => { _cachedToken = null; _cachedAt = 0 })

type TableName = 'chantiers_btp' | 'membres_btp' | 'equipes_btp' | 'pointages_btp' | 'depenses_btp' | 'situations_btp' | 'retenues_btp' | 'dc4_btp' | 'dce_analyses_btp' | 'dpgf_btp' | 'charges_fixes'
type ShortName = 'chantiers' | 'membres' | 'equipes' | 'pointages' | 'depenses' | 'situations' | 'retenues' | 'dc4' | 'dce_analyses' | 'dpgf' | 'charges_fixes'

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
}

// Map localStorage fields → Supabase columns
function mapToSupabase(table: ShortName, item: any): any {
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
        membreIds: item.membreIds || [], // handled separately in API
      }
    case 'pointages':
      return {
        employe: item.employe || '',
        poste: item.poste || null,
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
    default:
      return item
  }
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
    default:
      return item
  }
}

// ── In-memory cache to avoid re-fetching on every tab switch ──
const _dataCache: Record<string, { data: any[]; at: number }> = {}
const DATA_CACHE_TTL = 300_000 // 5 min — BTP data rarely changes mid-session

// ── Prefetch multiple tables in parallel to fill cache before components mount ──
export async function prefetchBTPTables(tables: ShortName[], userId: string) {
  const headers = await authHeaders()
  await Promise.all(
    tables.map(async (table) => {
      const cacheKey = `${table}_${userId}`
      if (_dataCache[cacheKey] && Date.now() - _dataCache[cacheKey].at < DATA_CACHE_TTL) return
      try {
        const res = await fetch(`/api/btp?table=${table}`, { headers })
        if (!res.ok) return
        const json = await res.json()
        const raw = json[table] || []
        _dataCache[cacheKey] = { data: raw.map((r: any) => mapFromSupabase(table, r)), at: Date.now() }
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
      const res = await fetch(`/api/btp?table=${table}`, { headers: await authHeaders() })
      if (!res.ok) throw new Error('Fetch failed')
      const json = await res.json()
      const raw = json[table] || []
      const mapped = raw.map((r: any) => mapFromSupabase(table, r))
      setItems(mapped)
      _dataCache[cacheKey] = { data: mapped, at: Date.now() }
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
              const mapped = parsed.map((item: any) => mapToSupabase(table, item))

              const res = await fetch('/api/btp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...await authHeaders() },
                body: JSON.stringify({ table: tableName, action: 'import', data: mapped }),
              })

              if (res.ok) {
                // Mark as imported in localStorage
                localStorage.setItem(`${lsKey}_migrated`, 'true')
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
      const json = await res.json()
      await refresh()
      return json.row ? mapFromSupabase(table, json.row) : null
    } catch (err) {
      console.error(`[btp] add ${tableName}:`, err)
      setError('Erreur lors de la création')
      return null
    }
  }, [table, tableName, refresh])

  const update = useCallback(async (id: string, changes: Partial<T>): Promise<boolean> => {
    try {
      const mapped = mapToSupabase(table, changes)
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: tableName, action: 'update', id, data: mapped }),
      })
      if (!res.ok) throw new Error(`Update ${tableName} failed: ${res.status}`)
      await refresh()
      return true
    } catch (err) {
      console.error(`[btp] update ${tableName}:`, err)
      setError('Erreur lors de la mise à jour')
      return false
    }
  }, [table, tableName, refresh])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeaders() },
        body: JSON.stringify({ table: tableName, action: 'delete', id }),
      })
      if (!res.ok) throw new Error(`Delete ${tableName} failed: ${res.status}`)
      await refresh()
      return true
    } catch (err) {
      console.error(`[btp] remove ${tableName}:`, err)
      setError('Erreur lors de la suppression')
      return false
    }
  }, [tableName, refresh])

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
          const { data: { user } } = await supabase.auth.getUser()
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

// ── Geo-pointage helper ───────────────────────────────────────────────────────

export function useGeoPointage() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [watching, setWatching] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)

  const start = useCallback(() => {
    if (!navigator.geolocation) return
    setWatching(true)
    setGeoError(null)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => { setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoError(null) },
      (err) => { setGeoError(err.code === 1 ? 'Permission GPS refusée' : err.code === 2 ? 'GPS indisponible' : 'GPS timeout'); console.warn('[geo] watchPosition error:', err.message) },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
  }, [])

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setWatching(false)
  }, [])

  // Distance en mètres entre deux points GPS
  const distanceTo = useCallback((lat2: number, lng2: number): number | null => {
    if (!position) return null
    const R = 6371000
    const dLat = (lat2 - position.lat) * Math.PI / 180
    const dLng = (lng2 - position.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(position.lat * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }, [position])

  useEffect(() => { return () => stop() }, [stop])

  return { position, watching, geoError, start, stop, distanceTo }
}
