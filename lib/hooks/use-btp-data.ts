'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// useBTPData — Hook universel pour les données BTP
// Remplace localStorage par Supabase, avec import automatique des données
// existantes au premier chargement.
// ═══════════════════════════════════════════════════════════════════════════════

type TableName = 'chantiers_btp' | 'membres_btp' | 'equipes_btp' | 'pointages_btp' | 'depenses_btp'
type ShortName = 'chantiers' | 'membres' | 'equipes' | 'pointages' | 'depenses'

const TABLE_MAP: Record<ShortName, TableName> = {
  chantiers: 'chantiers_btp',
  membres: 'membres_btp',
  equipes: 'equipes_btp',
  pointages: 'pointages_btp',
  depenses: 'depenses_btp',
}

// localStorage keys to check for import
const LS_KEYS: Record<ShortName, (id: string) => string> = {
  chantiers: (id) => `fixit_chantiers_${id}`,
  membres: (id) => `fixit_membres_${id}`,
  equipes: (id) => `fixit_equipes_btp_${id}`,
  pointages: (id) => `pointage_${id}`,
  depenses: (id) => `fixit_expenses_${id}`,
}

// Map localStorage fields → Supabase columns
function mapToSupabase(table: ShortName, item: any): any {
  switch (table) {
    case 'chantiers':
      return {
        titre: item.titre || '',
        client: item.client || null,
        adresse: item.adresse || null,
        date_debut: item.dateDebut || null,
        date_fin: item.dateFin || null,
        budget: item.budget ? parseFloat(item.budget) : null,
        statut: item.statut || 'En attente',
        description: item.description || null,
        equipe: item.equipe || null,
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
    default:
      return item
  }
}

interface UseBTPDataOptions {
  table: ShortName
  artisanId: string  // for localStorage import key
  userId: string     // Supabase auth user id
  autoImport?: boolean // import localStorage data on first load (default: true)
}

export function useBTPData<T = any>({ table, artisanId, userId, autoImport = true }: UseBTPDataOptions) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const imported = useRef(false)

  const tableName = TABLE_MAP[table]

  // ── Fetch from Supabase ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/btp?table=${table}`)
      if (!res.ok) throw new Error('Fetch failed')
      const json = await res.json()
      const raw = json[table] || []
      setItems(raw.map((r: any) => mapFromSupabase(table, r)))
      setError(null)
      return raw
    } catch (err) {
      setError('Erreur de chargement')
      return []
    } finally {
      setLoading(false)
    }
  }, [table])

  // ── Auto-import from localStorage on first load ─────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      const data = await refresh()

      // If Supabase is empty and localStorage has data → import
      if (autoImport && !imported.current && data.length === 0 && artisanId) {
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
                headers: { 'Content-Type': 'application/json' },
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
  }, [table, artisanId, autoImport, refresh, tableName])

  // ── CRUD operations ─────────────────────────────────────────────────────

  const add = useCallback(async (item: Partial<T>): Promise<T | null> => {
    try {
      const mapped = mapToSupabase(table, item)
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, action: 'insert', data: mapped }),
      })
      if (!res.ok) throw new Error('Insert failed')
      const json = await res.json()
      await refresh()
      return json.row ? mapFromSupabase(table, json.row) : null
    } catch {
      setError('Erreur lors de la création')
      return null
    }
  }, [table, tableName, refresh])

  const update = useCallback(async (id: string, changes: Partial<T>): Promise<boolean> => {
    try {
      const mapped = mapToSupabase(table, changes)
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, action: 'update', id, data: mapped }),
      })
      if (!res.ok) throw new Error('Update failed')
      await refresh()
      return true
    } catch {
      setError('Erreur lors de la mise à jour')
      return false
    }
  }, [table, tableName, refresh])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tableName, action: 'delete', id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      await refresh()
      return true
    } catch {
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

const DEFAULT_SETTINGS: BTPSettings = {
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

export function useBTPSettings() {
  const [settings, setSettings] = useState<BTPSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/btp?table=settings')
      if (!res.ok) throw new Error()
      const json = await res.json()
      if (json.settings) setSettings({ ...DEFAULT_SETTINGS, ...json.settings })
    } catch { /* use defaults */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const save = useCallback(async (changes: Partial<BTPSettings>) => {
    const updated = { ...settings, ...changes }
    setSettings(updated)
    try {
      await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'settings_btp', action: 'upsert_settings', data: changes }),
      })
    } catch { /* silent */ }
  }, [settings])

  return { settings, loading, save, refresh }
}

// ── Geo-pointage helper ───────────────────────────────────────────────────────

export function useGeoPointage() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [watching, setWatching] = useState(false)
  const watchId = useRef<number | null>(null)

  const start = useCallback(() => {
    if (!navigator.geolocation) return
    setWatching(true)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silent */ },
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

  return { position, watching, start, stop, distanceTo }
}
