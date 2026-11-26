'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/i18n/context'
import { normalizeForSearch, fuzzyFind } from '@/lib/fuzzy-match'
import { generateRapportPDF } from '@/lib/rapport-pdf'
import RapportPDFPreview from '@/components/dashboard/rapports/RapportPDFPreview'
import RapportTableRow from '@/components/dashboard/rapports/RapportTableRow'
import { documentsPourSynthese } from '@/lib/documents/liste-effective'
import { idFicheDocuments } from '@/lib/documents/identite-documents'
import { modeleRapportSociete } from '@/lib/pdf/modeles-societes'
import { carteDocumentsLies } from '@/components/dashboard/rapports/document-lie'
import { useThemeVars } from './useThemeVars'
import type { Artisan, Service, Booking } from '@/lib/types'

interface CompanyData {
  name?: string
  address?: string
  phone?: string
  email?: string
  siret?: string
  insuranceName?: string
  insuranceNumber?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface PhotoRecord {
  id: string
  url?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface MissionRecord {
  id: string
  source?: string
  locataire?: string
  titre?: string
  immeuble?: string
  lot?: string
  type?: string
  description?: string
  dateIntervention?: string
  date?: string
  devis?: string
  priorite?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface DevisFactureRef {
  id?: string
  docNumber?: string
  savedAt?: string
  clientName?: string
  docType?: string
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/* ══════════ RAPPORTS D'INTERVENTION ══════════ */

interface RapportIntervention {
  id: string
  rapportNumber: string
  createdAt: string
  linkedBookingId: string | null
  linkedPhotoIds?: string[]
  refDevisFact: string
  // Artisan
  artisanName: string
  artisanAddress: string
  artisanPhone: string
  artisanEmail: string
  artisanSiret: string
  artisanInsurance: string
  // Client
  clientName: string
  clientPhone: string
  clientEmail: string
  clientAddress: string
  // Intervention
  interventionDate: string
  startTime: string
  endTime: string
  siteAddress: string
  motif: string
  // Travaux
  travaux: string[]
  materiaux: string[]
  observations: string
  recommendations: string
  status: 'termine' | 'en_cours' | 'a_reprendre' | 'sous_garantie'
  sentStatus?: 'envoye' | 'non_envoye'
  sentAt?: string
  linkedDevisRef?: string
  linkedFactureRef?: string
  linkedDevisId?: string | null
  linkedFactureId?: string | null
}

const RAPPORT_STATUS_MAP = {
  termine: { label: '✅ Terminé', tagClass: 'v22-tag v22-tag-green' },
  en_cours: { label: '🔄 En cours', tagClass: 'v22-tag v22-tag-gray' },
  a_reprendre: { label: '⚠️ À reprendre', tagClass: 'v22-tag v22-tag-amber' },
  sous_garantie: { label: '🛡️ Sous garantie', tagClass: 'v22-tag v22-tag-gray' },
}

/** Ligne de rapports_btp d'un rapport : titre, date, contenu (le reste du rapport), photos liées, statut. */
function ligneRapport(r: RapportIntervention): Record<string, unknown> {
  const { id: _id, rapportNumber, interventionDate, linkedPhotoIds, status, ...rest } = r
  return {
    titre: rapportNumber || '',
    date: interventionDate || '',
    contenu: rest,
    photos: linkedPhotoIds || [],
    status: status || 'brouillon',
  }
}

// ── Rapports du BTP pro enregistrés dans rapports_btp (constats donnees-btp-13, stockage-local-miroir-14 et
// base-de-donnees-7 de l'audit du 11/11/2026) ──
// L'écriture directe de la base, sans propriétaire, était refusée en silence (owner_id obligatoire sans valeur par
// défaut en production) : la table restait vide. Pour le BTP pro, un NOUVEAU rapport part désormais par /api/btp, qui
// pose le propriétaire ; l'identifiant renvoyé par la base remplace l'identifiant local, et ses modifications et sa
// suppression suivent. Les rapports déjà présents dans le navigateur (identifiant local) n'y sont ni envoyés ni
// modifiés. Le navigateur et son miroir restent la référence : au chargement, la copie en base ne remplace jamais un
// rapport présent sur l'appareil, elle n'ajoute que ceux qui y manquent.
const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MESSAGE_RAPPORT_NON_ENREGISTRE = 'Rapport gardé sur cet appareil : sa copie en ligne n\'a pas pu être enregistrée.'
const MESSAGE_RAPPORT_NON_MIS_A_JOUR = 'Modification gardée sur cet appareil : la copie en ligne du rapport n\'a pas pu être mise à jour.'
const MESSAGE_RAPPORT_NON_SUPPRIME = 'Le rapport n\'a pas été supprimé. Réessayez dans un instant.'

/** Rapport présent en base : son identifiant est celui de la base (les identifiants locaux ne sont pas des UUID). */
const estEnBase = (id: string | undefined) => !!id && FORMAT_UUID.test(id)

/**
 * Issue de la création en base d'un rapport du BTP pro : son identifiant en base, ou null. `peutEtreEnBase` : la réponse
 * s'est perdue (coupure réseau, réponse illisible), la base a pu l'enregistrer sans qu'on connaisse son identifiant.
 */
type IssueCreation = { idBase: string | null; peutEtreEnBase: boolean }

/**
 * Créations du BTP pro de cette session, par clé du stockage et identifiant local (relecture adverse du 15/11/2026).
 * Un rapport supprimé ou modifié avant la réponse de sa création garde son identifiant local : la suppression ne visait
 * que l'appareil, sa ligne restait en base et revenait au chargement suivant ; la modification ne partait pas. Ils
 * attendent désormais l'issue de la création. Gardé au niveau du module : la page a pu être quittée entre-temps.
 */
const _creationsRapports = new Map<string, Promise<IssueCreation>>()

/**
 * Rapports de l'appareil complétés par la base : un rapport de l'appareil n'est jamais remplacé ; un rapport créé ici
 * dont la réponse du serveur s'est perdue (la base garde son identifiant local dans `idLocal`) prend l'identifiant de
 * la base au lieu d'apparaître deux fois ; les rapports absents de l'appareil sont ajoutés. null : rien ne change.
 */
function completerParLaBase(locaux: RapportIntervention[], enBase: RapportIntervention[]): RapportIntervention[] | null {
  const idsLocaux = new Set(locaux.map(r => r.id))
  const idDeLaBase = new Map<string, string>()
  const ajoutes: RapportIntervention[] = []
  for (const r of enBase) {
    if (idsLocaux.has(r.id)) continue
    const { idLocal, ...rapport } = r as RapportIntervention & { idLocal?: unknown }
    if (typeof idLocal === 'string' && idsLocaux.has(idLocal)) idDeLaBase.set(idLocal, r.id)
    else ajoutes.push(rapport)
  }
  if (idDeLaBase.size === 0 && ajoutes.length === 0) return null
  return [...locaux.map(r => (idDeLaBase.has(r.id) ? { ...r, id: idDeLaBase.get(r.id) ?? r.id } : r)), ...ajoutes]
}

/**
 * Ligne en base d'un rapport encore sous son identifiant local sur l'appareil : elle garde cet identifiant (`idLocal`),
 * qui la relie au rapport de l'appareil au chargement suivant (completerParLaBase). Une modification envoyée sans lui
 * (section quittée puis rouverte avant la réponse de la création) faisait apparaître le rapport deux fois sous le même
 * numéro (relecture adverse du 16/11/2026).
 */
function ligneAvecIdLocal(r: RapportIntervention): Record<string, unknown> {
  const ligne = ligneRapport(r)
  return { ...ligne, contenu: { ...(ligne.contenu as Record<string, unknown>), idLocal: r.id } }
}

/**
 * Applique `changer` à la liste des rapports RELUE sur l'appareil au moment d'écrire, et non à celle de la section qui a
 * lancé l'écriture : une écriture en base qui aboutit après qu'on a quitté puis rouvert la section n'efface plus ce que
 * la section rouverte a enregistré entre-temps (relecture adverse du 16/11/2026). Rien n'est écrit si la liste ne change
 * pas ou si le stockage est illisible ; rien n'en est jamais retiré d'autre que ce que `changer` retire.
 */
function modifierRapportsDuStockage(cle: string, changer: (liste: RapportIntervention[]) => RapportIntervention[]): void {
  let brut: string | null
  let liste: unknown
  try {
    brut = localStorage.getItem(cle)
    liste = brut ? JSON.parse(brut) : []
  } catch (e) {
    console.warn('[storage] rapports de l\'appareil illisibles : liste non réécrite', e)
    return
  }
  if (!Array.isArray(liste)) {
    console.warn('[storage] rapports de l\'appareil illisibles : liste non réécrite')
    return
  }
  const suivante = JSON.stringify(changer(liste as RapportIntervention[]))
  if (suivante === (brut ?? '[]')) return
  try { localStorage.setItem(cle, suivante) } catch (e) { console.warn('[storage] saveRapports', e) }
}

export default function RapportsSection({ artisan, bookings, services, onNavigate, orgRole, savedDocuments }: {
  artisan: Artisan | null
  bookings: Booking[]
  services: Service[]
  onNavigate?: (page: string) => void
  orgRole?: string
  /**
   * Devis et factures du tableau de bord. Pour un salarié invité d'une société, ce sont ceux de la SOCIÉTÉ, lus par
   * le serveur : son propre stockage ne contient que ses brouillons, et le sélecteur « lier à un document » ne lui
   * proposait donc rien — pas plus que le libellé du document lié dans la liste et dans le PDF.
   */
  savedDocuments?: readonly DevisFactureRef[]
}) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  // Vocabulaire propre aux sociétés de construction (« relatório de obra ») : réservé au BTP en portugais.
  const isBtp = orgRole === 'pro_societe'
  // Séparateur des listes déroulantes : pas de tiret cadratin dans les textes portugais.
  const sep = isPt ? ' · ' : ' — '

  // Règle n° 1 : la bascule de source ne vise que les sociétés BTP (gérant et salarié invité). Côté artisan, la
  // lecture du stockage reste celle d'avant ce lot. Attention, `isV5` (déclaré juste en dessous) couvre les DEUX
  // côtés : il ne peut pas servir ici.
  const documentsDeLaSociete = orgRole === 'pro_societe' ? savedDocuments : undefined

  // Documents rangés par identifiant, une fois pour toute la liste : les deux enfants y cherchent le libellé du
  // document auquel un rapport est rattaché, au lieu de relire la liste deux fois par ligne.
  const documentsParId = useMemo(
    () => carteDocumentsLies(documentsDeLaSociete, artisan?.id),
    [documentsDeLaSociete, artisan?.id],
  )
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_rapports_${artisan?.id}`
  const pdfRef = useRef<HTMLDivElement>(null)
  // BTP pro : nouveaux rapports enregistrés dans rapports_btp par /api/btp (voir ligneRapport plus haut). L'artisan garde
  // l'écriture d'avant.
  const enregistrementBTP = orgRole === 'pro_societe'
  // Gabarit de relatório propre à la société (BTP pro seulement, règle n° 1) ; fiche de la société pour un salarié invité.
  const modeleRapport = orgRole === 'pro_societe' ? modeleRapportSociete(idFicheDocuments(artisan)) : undefined

  const [rapports, setRapports] = useState<RapportIntervention[]>([])

  // Load rapports: Supabase (source of truth) merged with localStorage fallback
  useEffect(() => {
    if (!artisan?.id) return
    const lsKey = `fixit_rapports_${artisan.id}`;
    // Seed from localStorage immediately so the UI isn't blank
    try {
      const stored = localStorage.getItem(lsKey)
      if (stored) setRapports(JSON.parse(stored))
    } catch { /* ignore */ }
    // Then fetch from Supabase and merge (Supabase wins on id collision)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const res = await fetch('/api/btp?table=rapports', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const fromSupabase: RapportIntervention[] = (json.rapports || []).map((r: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const contenu = typeof r.contenu === 'object' && r.contenu !== null ? r.contenu : {}
          return {
            ...contenu,
            id: r.id,
            rapportNumber: r.titre || contenu.rapportNumber || '',
            interventionDate: r.date || contenu.interventionDate || '',
            linkedPhotoIds: Array.isArray(r.photos) ? r.photos : [],
            status: r.status || contenu.status || 'brouillon',
          } as RapportIntervention
        })
        if (fromSupabase.length > 0 && enregistrementBTP) {
          setRapports(prev => completerParLaBase(prev, fromSupabase) ?? prev)
          modifierRapportsDuStockage(lsKey, liste => completerParLaBase(liste, fromSupabase) ?? liste)
        } else if (fromSupabase.length > 0) {
          setRapports(prev => {
            // Supabase rows override local rows with same id; local-only rows are kept
            const sbIds = new Set(fromSupabase.map(r => r.id))
            const localOnly = prev.filter(r => !sbIds.has(r.id))
            const merged = [...fromSupabase, ...localOnly]
            try { localStorage.setItem(lsKey, JSON.stringify(merged)) } catch { /* ignore */ }
            return merged
          })
        }
      } catch { /* network error — localStorage data already shown */ }
    })()
  }, [artisan?.id, enregistrementBTP])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)
  const [previewRapport, setPreviewRapport] = useState<RapportIntervention | null>(null)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)

  const [form, setForm] = useState<Partial<RapportIntervention>>({})
  const [importSource, setImportSource] = useState<'intervention' | 'mission'>('intervention')
  const [linkingBooking, setLinkingBooking] = useState(false)

  // Photos chantier pour liaison
  const [availablePhotos, setAvailablePhotos] = useState<PhotoRecord[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [linkedPhotos, setLinkedPhotos] = useState<string[]>([])
  const [showPhotoPicker, setShowPhotoPicker] = useState(false)

  // ── Import depuis base client ──
  const [showClientImport, setShowClientImport] = useState(false)

  // ── Auto-complétion client + motif ──
  const [clientSuggestions, setClientSuggestions] = useState<{ name: string; phone?: string; email?: string; address?: string }[]>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [motifSuggestions, setMotifSuggestions] = useState<{ name: string; id?: string | undefined }[]>([])
  const [showMotifSuggestions, setShowMotifSuggestions] = useState(false)

  // Extraire les clients uniques des bookings + base clients manuelle
  const knownClients = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; email?: string; address?: string }>()
    for (const b of bookings) {
      const name = b.client_name || b.name || ''
      if (name && !map.has(normalizeForSearch(name))) {
        map.set(normalizeForSearch(name), {
          name,
          phone: b.client_phone || b.phone || '',
          email: b.client_email || b.email || '',
          address: b.address || b.client_address || '',
        })
      }
    }
    // Ajouter les clients manuels (localStorage)
    if (typeof window !== 'undefined' && artisan?.id) {
      try {
        const manual = JSON.parse(localStorage.getItem(`fixit_manual_clients_${artisan.id}`) || '[]')
        for (const c of manual) {
          const name = c.name || ''
          if (name && !map.has(normalizeForSearch(name))) {
            map.set(normalizeForSearch(name), {
              name,
              phone: c.phone || '',
              email: c.email || '',
              address: c.mainAddress || c.address || '',
            })
          }
        }
      } catch { /* ignore */ }
    }
    return Array.from(map.values())
  }, [bookings, artisan?.id])

  // Noms de services/motifs
  const knownMotifs = useMemo(() => {
    return services.map((s) => ({ name: s.name || '', id: s.id })).filter((m) => m.name)
  }, [services])

  // Recherche client quand l'utilisateur tape
  const handleClientNameChange = (value: string) => {
    setForm(p => ({ ...p, clientName: value }))
    if (value.length >= 2 && knownClients.length > 0) {
      const matches = knownClients.filter(c => {
        const cn = normalizeForSearch(c.name)
        const sv = normalizeForSearch(value)
        return cn.includes(sv) || sv.includes(cn) || cn.split(/\s+/).some(w => w.startsWith(sv)) || sv.split(/\s+/).some(w => cn.includes(w))
      }).slice(0, 5)
      // Ajouter fuzzy match si rien trouvé
      if (matches.length === 0) {
        const fuzzy = fuzzyFind(value, knownClients, c => c.name, 0.7)
        if (fuzzy) matches.push(fuzzy)
      }
      setClientSuggestions(matches)
      setShowClientSuggestions(matches.length > 0)
    } else {
      setShowClientSuggestions(false)
    }
  }

  const selectClientSuggestion = (client: typeof knownClients[0]) => {
    setForm(p => ({
      ...p,
      clientName: client.name,
      clientPhone: client.phone || p.clientPhone || '',
      clientEmail: client.email || p.clientEmail || '',
      clientAddress: client.address || p.clientAddress || '',
    }))
    setShowClientSuggestions(false)
  }

  // Recherche motif quand l'utilisateur tape
  const handleMotifChange = (value: string) => {
    setForm(p => ({ ...p, motif: value }))
    if (value.length >= 2 && knownMotifs.length > 0) {
      const matches = knownMotifs.filter(m => {
        const mn = normalizeForSearch(m.name)
        const sv = normalizeForSearch(value)
        return mn.includes(sv) || sv.includes(mn)
      }).slice(0, 5)
      if (matches.length === 0) {
        const fuzzy = fuzzyFind(value, knownMotifs, m => m.name, 0.7)
        if (fuzzy) matches.push(fuzzy)
      }
      setMotifSuggestions(matches)
      setShowMotifSuggestions(matches.length > 0)
    } else {
      setShowMotifSuggestions(false)
    }
  }

  const selectMotifSuggestion = (motif: { name: string; id?: string }) => {
    setForm(p => ({ ...p, motif: motif.name }))
    setShowMotifSuggestions(false)
  }

  // Load missions from localStorage (syndic + gestionnaire)
  const [availableMissions, setAvailableMissions] = useState<MissionRecord[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !artisan?.id) return
    try {
      const allMissions: MissionRecord[] = []
      // 1. Missions gestionnaire
      const gestKey = `fixit_missions_gest_${artisan.id}`
      try {
        const gest = JSON.parse(localStorage.getItem(gestKey) || '[]')
        gest.forEach((m: MissionRecord) => allMissions.push({ ...m, source: 'gestionnaire' }))
      } catch {}
      // 2. Ordres de mission syndic (canal artisan)
      // Utiliser artisan.id comme clé stable (company_name peut changer)
      const artisanKey = `canal_artisan_${artisan.id}`
      try {
        const ordres = JSON.parse(localStorage.getItem(artisanKey) || '[]')
        ordres.forEach((m: MissionRecord) => allMissions.push({ ...m, source: 'syndic' }))
      } catch {}
      setAvailableMissions(allMissions)
    } catch {}
  }, [artisan?.id, artisan?.company_name, artisan?.nom])

  // Auth helper for API calls
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}` }
      }
    } catch {}
    return {}
  }

  // Load available photos chantier for linking. Rend la liste lue : le PDF lancé juste après ne voit pas encore l'état.
  const loadAvailablePhotos = async (): Promise<PhotoRecord[]> => {
    if (!artisan?.id) return []
    setPhotosLoading(true)
    let lues: PhotoRecord[] = []
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/artisan-photos?artisan_id=${artisan.id}`, { headers })
      const json = await res.json()
      if (json.data) {
        lues = json.data
        setAvailablePhotos(json.data)
      }
    } catch (e) {
      console.error('Error loading photos for rapport:', e)
    } finally {
      setPhotosLoading(false)
    }
    return lues
  }

  // Fetch artisan company data once (with auth)
  useEffect(() => {
    if (!artisan?.id) return
    ;(async () => {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`/api/artisan-company?artisan_id=${artisan.id}`, { headers })
        const d = await res.json()
        if (d.company) setCompanyData(d.company)
      } catch {}
    })()
  }, [artisan?.id])

  const ecrireRapportsLocaux = (liste: RapportIntervention[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(liste)) } catch (e) { console.warn('[storage] saveRapports', e) }
  }

  const saveRapports = (updated: RapportIntervention[]) => {
    setRapports(updated)
    ecrireRapportsLocaux(updated)
    // BTP pro : seul le rapport créé, modifié ou supprimé s'enregistre en base (enregistrerRapportBTP plus bas).
    if (enregistrementBTP) return
    // Fire-and-forget Supabase sync for each rapport
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        for (const r of updated) {
          const isLocalId = !r.id || r.id.startsWith('rap_')
          const row = ligneRapport(r)
          if (isLocalId) {
            // New rapport: insert without id so Supabase generates a UUID
            supabase.from('rapports_btp').insert(row).then(() => {})
          } else {
            // Existing rapport with Supabase UUID: upsert
            supabase.from('rapports_btp').upsert({ id: r.id, ...row }).then(() => {})
          }
        }
      } catch { /* fire-and-forget — localStorage remains source of truth on failure */ }
    })()
  }

  /** POST /api/btp sur rapports_btp (le serveur pose le propriétaire) ; null si la requête n'a pas pu partir. */
  const ecrireRapportBTP = async (corps: Record<string, unknown>): Promise<Response | null> => {
    try {
      return await fetch('/api/btp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ table: 'rapports_btp', ...corps }),
      })
    } catch (err) {
      console.error('[btp] rapport : écriture en ligne impossible :', err)
      return null
    }
  }

  const cleCreation = (idLocal: string) => `${storageKey}/${idLocal}`

  /** BTP pro : crée en base un rapport qu'on vient de créer ; son identifiant en base remplace l'identifiant local. */
  const creerRapportBTP = async (r: RapportIntervention): Promise<IssueCreation> => {
    // L'identifiant local, gardé en base, évite un doublon si la réponse du serveur se perd (completerParLaBase).
    const res = await ecrireRapportBTP({ action: 'insert', data: ligneAvecIdLocal(r) })
    if (!res?.ok) {
      if (res) console.error(`[btp] rapport refusé (${res.status})`)
      toast.error(MESSAGE_RAPPORT_NON_ENREGISTRE, { id: 'btp-ecriture-rapports' })
      // Sans réponse du serveur, la base a pu l'enregistrer ; un refus ne crée rien.
      return { idBase: null, peutEtreEnBase: res === null }
    }
    let idBase: unknown = null
    try {
      idBase = ((await res.json()) as { row?: { id?: unknown } }).row?.id
    } catch (err) {
      console.warn('[btp] rapport enregistré, réponse illisible : identifiant repris au prochain chargement', err)
    }
    if (typeof idBase !== 'string' || !estEnBase(idBase)) return { idBase: null, peutEtreEnBase: true }
    const idEnregistre = idBase
    const remplacer = (liste: RapportIntervention[]) => liste.map(x => (x.id === r.id ? { ...x, id: idEnregistre } : x))
    setRapports(remplacer)
    modifierRapportsDuStockage(storageKey, remplacer)
    setEditingId(courant => (courant === r.id ? idEnregistre : courant))
    return { idBase: idEnregistre, peutEtreEnBase: false }
  }

  /**
   * BTP pro : enregistre en base un rapport qu'on vient de créer (identifiant local) ou de modifier (déjà en base, ou
   * créé pendant cette session : sa création est attendue). Un rapport créé avant cette correction (identifiant local,
   * jamais en base) n'est pas envoyé.
   */
  const enregistrerRapportBTP = async (r: RapportIntervention, creation: boolean) => {
    if (creation) {
      _creationsRapports.set(cleCreation(r.id), creerRapportBTP(r))
      return
    }
    let id: string | null = r.id
    let ligne = ligneRapport(r)
    if (!estEnBase(r.id)) {
      const enCours = _creationsRapports.get(cleCreation(r.id))
      id = enCours ? (await enCours).idBase : null
      if (!id) return
      // Encore sous son identifiant local sur l'appareil : la ligne en base garde le lien avec lui.
      ligne = ligneAvecIdLocal(r)
    }
    const res = await ecrireRapportBTP({ action: 'update', id, data: ligne })
    if (!res?.ok) {
      if (res) console.error(`[btp] rapport refusé (${res.status})`)
      toast.error(MESSAGE_RAPPORT_NON_MIS_A_JOUR, { id: 'btp-ecriture-rapports' })
    }
  }

  /**
   * Ligne en base d'un rapport créé sur cet appareil, retrouvée par l'identifiant local gardé dans son contenu : son
   * identifiant, null si elle n'existe pas, undefined si la base n'a pas pu être lue.
   */
  const retrouverRapportEnBase = async (idLocal: string): Promise<string | null | undefined> => {
    try {
      const res = await fetch('/api/btp?table=rapports', { headers: await getAuthHeaders() })
      if (!res.ok) {
        console.error(`[btp] rapports : lecture en ligne refusée (${res.status})`)
        return undefined
      }
      const lignes = ((await res.json()) as { rapports?: Array<{ id?: unknown; contenu?: unknown }> }).rapports ?? []
      const ligne = lignes.find(l => typeof l.contenu === 'object' && l.contenu !== null && (l.contenu as { idLocal?: unknown }).idLocal === idLocal)
      return typeof ligne?.id === 'string' ? ligne.id : null
    } catch (err) {
      console.error('[btp] rapports : lecture en ligne impossible :', err)
      return undefined
    }
  }

  const nextNumber = () => {
    const year = new Date().getFullYear()
    const existing = rapports.filter(r => r.rapportNumber?.startsWith(`RAP-${year}`))
    const maxNum = existing.reduce((max, r) => {
      const n = parseInt(r.rapportNumber?.split('-').pop() || '0', 10)
      return n > max ? n : max
    }, 0)
    return `RAP-${year}-${String(maxNum + 1).padStart(3, '0')}`
  }

  const openNew = () => {
    const a: any = artisan || {} // eslint-disable-line @typescript-eslint/no-explicit-any
    const c: any = companyData || {} // eslint-disable-line @typescript-eslint/no-explicit-any
    setEditingId(null)
    setLinkedPhotos([])
    setForm({
      rapportNumber: nextNumber(),
      createdAt: new Date().toISOString(),
      linkedBookingId: null,
      linkedPhotoIds: [],
      refDevisFact: '',
      artisanName: c.name || a.company_name || '',
      artisanAddress: c.address || a.company_address || a.address || '',
      artisanPhone: c.phone || a.phone || '',
      artisanEmail: c.email || a.email || '',
      artisanSiret: c.siret || a.siret || '',
      artisanInsurance: c.insuranceName ? `${c.insuranceName} n°${c.insuranceNumber}` : '',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      clientAddress: '',
      interventionDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '',
      siteAddress: '',
      motif: '',
      travaux: [''],
      materiaux: [''],
      observations: '',
      recommendations: '',
      status: 'termine',
      sentStatus: 'non_envoye',
    })
    loadAvailablePhotos()
    setShowForm(true)
  }

  const openEdit = (r: RapportIntervention) => {
    setEditingId(r.id)
    setLinkedPhotos(r.linkedPhotoIds || [])
    setForm({ ...r })
    loadAvailablePhotos()
    setShowForm(true)
  }

  // Link to a booking → pre-fill client + site info
  const linkBooking = async (bookingId: string) => {
    if (!bookingId) {
      setForm(prev => ({ ...prev, linkedBookingId: null, clientName: '', clientPhone: '', clientEmail: '', siteAddress: '' }))
      return
    }
    const b = bookings.find(x => x.id === bookingId)
    if (!b) return

    setLinkingBooking(true)
    try {
      // Parse client info from notes — two formats:
      //   Client booking: "Client: Jean | Tel: 06… | Email: jean@… | notes…"
      //   Artisan RDV:    "Client: Jean Dupont. description…"
      const rawNotes = b.notes || ''
      const hasPipes = rawNotes.includes('|')
      const parseField = (label: string) => {
        if (hasPipes) {
          const m = rawNotes.match(new RegExp(`${label}:\\s*([^|\\n]+)`, 'i'))
          return m ? m[1].trim() : ''
        } else {
          const m = rawNotes.match(new RegExp(`${label}:\\s*([^.\\n]+)`, 'i'))
          return m ? m[1].trim() : ''
        }
      }

      const clientName = parseField('Client')
      const clientPhone = parseField('Tel')
      const clientEmail = parseField('Email')

      setForm(prev => ({
        ...prev,
        linkedBookingId: bookingId,
        clientName: clientName || '',
        clientPhone: clientPhone || '',
        clientEmail: clientEmail && clientEmail !== '-' ? clientEmail : '',
        siteAddress: b.address || '',
        interventionDate: b.booking_date || prev.interventionDate,
        startTime: b.booking_time?.substring(0, 5) || prev.startTime,
        motif: b.services?.name || prev.motif || '',
      }))

      // Enrich via API if client has a Fixit account
      if (b.client_id) {
        try {
          const headers = await getAuthHeaders()
          const res = await fetch(`/api/artisan-clients?client_id=${b.client_id}`, { headers })
          if (res.ok) {
            const cd = await res.json()
            setForm(prev => ({
              ...prev,
              clientName: cd.name || prev.clientName,
              clientPhone: cd.phone || prev.clientPhone,
              clientEmail: cd.email || prev.clientEmail,
              clientAddress: cd.address || prev.clientAddress,
            }))
          }
        } catch { /* ignore — we already have notes data */ }
      }
    } finally {
      setLinkingBooking(false)
    }
  }

  // Import from mission (syndic/gestionnaire) → pre-fill rapport
  const linkMission = (missionId: string) => {
    if (!missionId) {
      setForm(prev => ({ ...prev, linkedBookingId: null, clientName: '', clientPhone: '', clientEmail: '', siteAddress: '', motif: '' }))
      return
    }
    const m = availableMissions.find(x => x.id === missionId)
    if (!m) return

    setForm(prev => ({
      ...prev,
      linkedBookingId: null,
      clientName: m.locataire || m.titre || '',
      clientAddress: m.immeuble ? `${m.immeuble}${m.lot ? ` — Lot ${m.lot}` : ''}` : '',
      siteAddress: m.immeuble ? `${m.immeuble}${m.lot ? ` — Lot ${m.lot}` : ''}` : prev.siteAddress || '',
      motif: m.type || m.titre || m.description || prev.motif || '',
      interventionDate: m.dateIntervention || m.date || prev.interventionDate,
      observations: m.description || '',
      refDevisFact: m.devis || prev.refDevisFact || '',
    }))
  }

  const saveForm = () => {
    const rapport: RapportIntervention = {
      ...form as RapportIntervention,
      travaux: (form.travaux || ['']).filter(t => t.trim()),
      materiaux: (form.materiaux || ['']).filter(m => m.trim()),
      linkedPhotoIds: linkedPhotos,
    }
    if (editingId) {
      const modifie = { ...rapport, id: editingId }
      saveRapports(rapports.map(r => r.id === editingId ? modifie : r))
      if (enregistrementBTP) void enregistrerRapportBTP(modifie, false)
    } else {
      const nouveau = { ...rapport, id: `rap_${Date.now()}` }
      saveRapports([nouveau, ...rapports])
      if (enregistrementBTP) void enregistrerRapportBTP(nouveau, true)
    }
    setShowForm(false)
  }

  // Toggle photo link
  const togglePhotoLink = (photoId: string) => {
    setLinkedPhotos(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    )
  }

  // BTP pro : un rapport en base n'est retiré de l'appareil qu'une fois supprimé en base (sinon il y resterait et
  // reviendrait au chargement suivant) ; un refus est annoncé et le rapport reste affiché. `idLocal` : identifiant local
  // d'un rapport créé pendant cette session, qui peut encore figurer sous cet identifiant sur l'appareil.
  const supprimerRapportBTP = async (id: string, idLocal?: string) => {
    const res = await ecrireRapportBTP({ action: 'delete', id })
    if (!res?.ok) {
      if (res) console.error(`[btp] suppression du rapport refusée (${res.status})`)
      toast.error(MESSAGE_RAPPORT_NON_SUPPRIME, { id: 'btp-ecriture-rapports' })
      return
    }
    if (idLocal) _creationsRapports.delete(cleCreation(idLocal))
    const retirer = (liste: RapportIntervention[]) => liste.filter(r => r.id !== id && r.id !== idLocal)
    setRapports(retirer)
    modifierRapportsDuStockage(storageKey, retirer)
  }

  /**
   * BTP pro : rapport créé pendant cette session, encore sous son identifiant local. L'issue de sa création est attendue ;
   * s'il est en base (identifiant renvoyé, ou retrouvé par son identifiant local après une réponse perdue), il y est
   * supprimé avant d'être retiré de l'appareil.
   */
  const supprimerRapportCree = async (idLocal: string, creation: Promise<IssueCreation>) => {
    const issue = await creation
    let idBase = issue.idBase
    if (!idBase && issue.peutEtreEnBase) {
      const retrouve = await retrouverRapportEnBase(idLocal)
      if (retrouve === undefined) {
        toast.error(MESSAGE_RAPPORT_NON_SUPPRIME, { id: 'btp-ecriture-rapports' })
        return
      }
      idBase = retrouve
    }
    if (idBase) {
      await supprimerRapportBTP(idBase, idLocal)
      return
    }
    _creationsRapports.delete(cleCreation(idLocal))
    const retirer = (liste: RapportIntervention[]) => liste.filter(r => r.id !== idLocal)
    setRapports(retirer)
    modifierRapportsDuStockage(storageKey, retirer)
  }

  const deleteRapport = (id: string) => {
    if (!confirm(isPt ? 'Eliminar este relatório?' : 'Supprimer ce rapport ?')) return
    if (enregistrementBTP && estEnBase(id)) {
      void supprimerRapportBTP(id)
      return
    }
    const creation = enregistrementBTP ? _creationsRapports.get(cleCreation(id)) : undefined
    if (creation) {
      void supprimerRapportCree(id, creation)
      return
    }
    saveRapports(rapports.filter(r => r.id !== id))
    // Fire-and-forget Supabase delete for UUID rows (artisan ; au BTP pro, un rapport sans UUID n'est pas en base)
    if (!enregistrementBTP && id && !id.startsWith('rap_')) {
      supabase.from('rapports_btp').delete().eq('id', id).then(() => {})
    }
  }

  // ═══ PDF generation — delegated to lib/rapport-pdf.ts ═══
  const handleGeneratePDF = async (r: RapportIntervention) => {
    setPdfLoading(r.id)
    try {
      // Photos lues ici quand l'écran ne les a pas encore : l'état `availablePhotos` de ce rendu resterait vide, et le
      // PDF sortait sans les photos liées.
      const photos = r.linkedPhotoIds?.length && availablePhotos.length === 0 ? await loadAvailablePhotos() : availablePhotos
      await generateRapportPDF(r, photos, dateFmtLocale, orgRole, modeleRapport)
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPreviewRapport(null)
      setPdfLoading(null)
    }
  }

  const markRapportSent = (id: string) => {
    const now = new Date().toISOString()
    const suivants = rapports.map(x => x.id === id ? { ...x, sentStatus: 'envoye' as const, sentAt: now } : x)
    saveRapports(suivants)
    const envoye = suivants.find(x => x.id === id)
    if (enregistrementBTP && envoye) void enregistrerRapportBTP(envoye, false)
  }

  const fv = (v: string | undefined) => v || ''

  return (
    <div className={isV5 ? 'v5-fade' : ''}>
      {/* ── Header ── */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h1 className={isV5 ? '' : 'v22-page-title'}>{isPt ? (isBtp ? 'Relatórios de obra' : 'Relatórios de intervenção') : <>Rapports d&apos;Intervention</>}</h1>
          <p className={isV5 ? '' : 'v22-page-sub'}>{isPt ? (isBtp ? 'Relatórios e diário de obra associados às suas intervenções' : 'Relatórios associados às suas intervenções') : 'Compte-rendus BTP, liés à vos interventions'}</p>
        </div>
        <button onClick={openNew} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
          {isPt ? '+ Novo relatório' : '+ Nouveau rapport'}
        </button>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
      <div className={isV5 ? 'v5-modal-ov show' : 'v22-modal-overlay open'}>
        {showForm && (
          <div className={isV5 ? 'v5-modal' : 'v22-modal v22-modal--tall'} style={{ maxWidth: '720px' }}>
            <div className={isV5 ? 'v5-modal-h' : 'v22-modal-head'}>
              <span className={isV5 ? 'v5-modal-t' : 'v22-modal-title'}>
                {isPt
                  ? (editingId ? 'Editar relatório' : (isBtp ? 'Novo relatório de obra' : 'Novo relatório de intervenção'))
                  : (editingId ? 'Modifier le rapport' : 'Nouveau rapport d\'intervention')}
              </span>
              <span className="v22-ref">{fv(form.rapportNumber)}</span>
              <button onClick={() => setShowForm(false)} className="v22-modal-close">✕</button>
            </div>

            <div className={isV5 ? '' : 'v22-modal-body'}>
              {/* Liaison intervention / mission */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Importação rápida: pré-preencher a partir de' : 'Import rapide : pre-remplir depuis'}</span>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                      onClick={() => setImportSource('intervention')}
                      className={importSource === 'intervention' ? (isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary') : (isV5 ? 'v5-btn' : 'v22-btn')}
                      style={{ flex: 1 }}
                    >
                      {isPt ? 'Intervenção de cliente' : 'Intervention client'}
                    </button>
                    <button
                      onClick={() => setImportSource('mission')}
                      className={importSource === 'mission' ? (isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary') : (isV5 ? 'v5-btn' : 'v22-btn')}
                      style={{ flex: 1 }}
                    >
                      {isPt ? 'Missão de condomínio / gestor' : 'Mission syndic / pro'}
                    </button>
                  </div>

                  {importSource === 'intervention' ? (
                    <select
                      onChange={e => linkBooking(e.target.value)}
                      defaultValue=""
                      className={isV5 ? 'v5-fi' : 'v22-form-input'}
                      disabled={linkingBooking}
                    >
                      <option value="">{isPt
                        ? (linkingBooking ? 'A carregar os dados do cliente...' : 'Selecione uma intervenção para pré-preencher...')
                        : (linkingBooking ? 'Chargement des donnees client...' : 'Selectionner une intervention pour pre-remplir...')}</option>
                      {[...bookings].filter(b => b.status === 'confirmed' || b.status === 'completed').slice(0, 20).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.booking_date} {b.booking_time?.substring(0, 5)}{sep}{b.services?.name || (isPt ? 'Intervenção' : 'Intervention')}{sep}{b.address || (isPt ? 'Morada não definida' : 'Adresse non definie')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        onChange={e => linkMission(e.target.value)}
                        defaultValue=""
                        className={isV5 ? 'v5-fi' : 'v22-form-input'}
                      >
                        <option value="">{isPt ? 'Selecione uma missão para pré-preencher...' : 'Selectionner une mission pour pre-remplir...'}</option>
                        {availableMissions.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.source === 'syndic' ? '🏛️' : '🏢'} {m.titre || m.type || (isPt ? 'Missão' : 'Mission')}{sep}{m.immeuble || m.locataire || 'N/D'}{sep}{m.dateIntervention || m.date || (isPt ? 'Data N/D' : 'Date N/D')}
                            {m.priorite === 'urgente' ? (isPt ? ' ⚠️ URGENTE' : ' ⚠️ URGENT') : ''}
                          </option>
                        ))}
                      </select>
                      {availableMissions.length === 0 && (
                        <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '8px', fontStyle: 'italic' }}>{isPt
                          ? 'Nenhuma missão disponível. As missões aparecem aqui a partir das suas ordens de missão ou das missões do gestor.'
                          : 'Aucune mission disponible. Les missions apparaissent ici depuis vos Ordres de Mission ou missions gestionnaire.'}</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Ref. devis / facture + statut */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Associar a um orçamento / fatura' : 'Lier a un Devis / Facture'}</label>
                  <select
                    value={fv(form.refDevisFact)}
                    onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'}
                  >
                    <option value="">{isPt ? 'Nenhum documento associado' : 'Aucun document lie'}</option>
                    {(() => {
                      try {
                        return documentsPourSynthese<DevisFactureRef>(documentsDeLaSociete, artisan?.id, true)
                          .filter((d: DevisFactureRef) => d.docNumber)
                          .sort((a: DevisFactureRef, b: DevisFactureRef) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                          .map((d: DevisFactureRef) => (
                            <option key={d.id || d.docNumber} value={d.docNumber}>
                              {d.docNumber}{sep}{d.clientName || (isPt ? 'Cliente' : 'Client')}{sep}{isPt ? (d.docType === 'devis' ? 'Orçamento' : 'Fatura') : (d.docType === 'devis' ? 'Devis' : 'Facture')}
                            </option>
                          ))
                      } catch { return null }
                    })()}
                  </select>
                  <input type="text" value={fv(form.refDevisFact)} onChange={e => setForm(p => ({ ...p, refDevisFact: e.target.value }))}
                    placeholder={isPt ? 'Ou introduza manualmente: DEV-2026-001' : 'Ou saisir manuellement : DEV-2026-001'}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ marginTop: '6px' }} />
                </div>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Estado' : 'Statut'}</label>
                  <select value={fv(form.status)} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'}>
                    <option value="termine">{isPt ? 'Concluído' : 'Terminé'}</option>
                    <option value="en_cours">{isPt ? 'Em curso' : 'En cours'}</option>
                    <option value="a_reprendre">{isPt ? 'A retomar' : 'À reprendre'}</option>
                    <option value="sous_garantie">{isPt ? 'Em garantia' : 'Sous garantie'}</option>
                  </select>
                </div>
              </div>

              {/* Section Client */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Cliente' : 'Client'}</span>
                  <button
                    onClick={() => setShowClientImport(!showClientImport)}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                    style={{ fontSize: 11 }}
                  >
                    {isPt
                      ? (showClientImport ? 'Fechar' : '📥 Importar da base de clientes')
                      : (showClientImport ? 'Fermer' : '📥 Importer depuis base client')}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {/* Import depuis base client */}
                  {showClientImport && (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: isV5 ? '#FFFBEB' : '#F9FAFB', borderRadius: 6, border: `1px solid ${isV5 ? '#FDE68A' : '#E5E7EB'}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{isPt ? 'Selecione um cliente:' : 'Selectionner un client :'}</div>
                      {knownClients.length === 0 ? (
                        <p style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>{isPt
                          ? 'Nenhum cliente na base. Adicione clientes na secção Clientes ou no Portal cliente.'
                          : 'Aucun client dans la base. Ajoutez des clients via la section Base clients ou le Portail client.'}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                          {knownClients.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                selectClientSuggestion(c)
                                setShowClientImport(false)
                              }}
                              className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                              style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '8px 10px', fontSize: 11 }}
                            >
                              <div><strong>{c.name}</strong></div>
                              <div style={{ color: '#888', fontSize: 10 }}>
                                {[c.phone, c.email, c.address].filter(Boolean).join(' · ') || (isPt ? 'Sem contactos' : 'Pas de coordonnees')}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ position: 'relative' }}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome / Denominação social *' : 'Nom / Raison sociale *'}</label>
                      <input type="text" value={fv(form.clientName)} onChange={e => handleClientNameChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                        placeholder={isPt ? 'João Silva' : 'Jean Dupont'} className={isV5 ? 'v5-fi' : 'v22-form-input'} autoComplete="off" />
                      {showClientSuggestions && clientSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 180, overflowY: 'auto' }}>
                          {clientSuggestions.map((c, i) => (
                            <button key={i} onMouseDown={() => selectClientSuggestion(c)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: `1px solid ${tv.border}` }}>
                              <div style={{ fontWeight: 600 }}>{c.name}</div>
                              {c.phone && <div style={{ color: tv.textMuted, fontSize: 10 }}>{c.phone}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Telefone' : 'Telephone'}</label>
                      <input type="tel" value={fv(form.clientPhone)} onChange={e => setForm(p => ({ ...p, clientPhone: e.target.value }))}
                        placeholder={isPt ? '912 345 678' : '06 00 00 00 00'} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Email</label>
                      <input type="email" value={fv(form.clientEmail)} onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                        placeholder={isPt ? 'cliente@exemplo.pt' : 'client@exemple.fr'} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Morada do cliente' : 'Adresse client'}</label>
                      <input type="text" value={fv(form.clientAddress)} onChange={e => setForm(p => ({ ...p, clientAddress: e.target.value }))}
                        placeholder={isPt ? 'Rua das Flores, 12, 4050-...' : '12 rue de la Paix, 13600...'} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Intervention */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Detalhes da intervenção' : <>Details de l&apos;intervention</>}</span>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Data *' : 'Date *'}</label>
                      <input type="date" value={fv(form.interventionDate)} onChange={e => setForm(p => ({ ...p, interventionDate: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Hora de início' : 'Heure debut'}</label>
                      <input type="time" value={fv(form.startTime)} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                    <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                      <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Hora de fim' : 'Heure fin'}</label>
                      <input type="time" value={fv(form.endTime)} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                    </div>
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ marginBottom: '10px' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Morada da obra (se diferente da do cliente)' : 'Adresse du chantier (si differente du client)'}</label>
                    <input type="text" value={fv(form.siteAddress)} onChange={e => setForm(p => ({ ...p, siteAddress: e.target.value }))}
                      placeholder={isPt ? 'Morada da intervenção...' : "Adresse d'intervention..."} className={isV5 ? 'v5-fi' : 'v22-form-input'} />
                  </div>
                  <div className={isV5 ? 'v5-fg' : 'v22-form-group'} style={{ position: 'relative' }}>
                    <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Motivo / Descrição do problema *' : 'Motif / Description du probleme *'}</label>
                    <textarea value={fv(form.motif)} onChange={e => handleMotifChange(e.target.value)}
                      onBlur={() => setTimeout(() => setShowMotifSuggestions(false), 200)}
                      rows={2} placeholder={isPt ? 'Fuga debaixo do lava-loiça da cozinha, substituição de torneira avariada...' : 'Fuite sous evier cuisine, remplacement robinet defectueux...'}
                      className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                    {showMotifSuggestions && motifSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: tv.surface, border: `1px solid ${tv.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 160, overflowY: 'auto' }}>
                        {motifSuggestions.map((m, i) => (
                          <button key={i} onMouseDown={() => selectMotifSuggestion(m)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--v22-bg)] transition" style={{ borderBottom: `1px solid ${tv.border}` }}>
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Travaux realises */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Trabalhos realizados' : 'Travaux realises'}</span>
                  <button onClick={() => setForm(p => ({ ...p, travaux: [...(p.travaux || []), ''] }))}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}>
                    {isPt ? '+ Adicionar' : '+ Ajouter'}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {(form.travaux || ['']).map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className={isV5 ? '' : 'v22-card-meta'}>✓</span>
                      <input type="text" value={t} onChange={e => setForm(p => ({ ...p, travaux: (p.travaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder={isPt ? 'Remoção e substituição da torneira misturadora...' : 'Depose et remplacement du robinet mitigeur...'}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ flex: 1 }} />
                      {(form.travaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, travaux: (p.travaux || []).filter((_, j) => j !== i) }))}
                          className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ color: tv.red }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Materiaux */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Materiais utilizados' : 'Materiaux utilises'}</span>
                  <button onClick={() => setForm(p => ({ ...p, materiaux: [...(p.materiaux || []), ''] }))}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}>
                    {isPt ? '+ Adicionar' : '+ Ajouter'}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {(form.materiaux || ['']).map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span className={isV5 ? '' : 'v22-card-meta'}>{isPt ? '•' : '—'}</span>
                      <input type="text" value={m} onChange={e => setForm(p => ({ ...p, materiaux: (p.materiaux || []).map((x, j) => j === i ? e.target.value : x) }))}
                        placeholder={isPt ? 'Torneira misturadora Grohe (1 un.), vedante 3/4 (2 un.)...' : 'Robinet mitigeur Grohe (1u), Joint 3/4 (2u)...'}
                        className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ flex: 1 }} />
                      {(form.materiaux || []).length > 1 && (
                        <button onClick={() => setForm(p => ({ ...p, materiaux: (p.materiaux || []).filter((_, j) => j !== i) }))}
                          className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'} style={{ color: tv.red }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations + Recommandations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Observações' : 'Observations'}</label>
                  <textarea value={fv(form.observations)} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                    rows={3} placeholder={isPt ? 'Constatações no local, estado do material existente...' : 'Constatations sur place, etat du materiel existant...'}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                </div>
                <div className={isV5 ? 'v5-fg' : 'v22-form-group'}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Recomendações' : 'Recommandations'}</label>
                  <textarea value={fv(form.recommendations)} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))}
                    rows={3} placeholder={isPt ? 'Trabalhos complementares aconselhados, prazo de revisão...' : 'Travaux complementaires conseilles, delai de revision...'}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ resize: 'none' }} />
                </div>
              </div>

              {/* Photos Chantier liees */}
              <div className={isV5 ? 'v5-card' : 'v22-card'}>
                <div className={isV5 ? '' : 'v22-card-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Fotos da obra' : 'Photos Chantier'}</span>
                  <button
                    type="button"
                    onClick={() => { setShowPhotoPicker(!showPhotoPicker); if (!showPhotoPicker && availablePhotos.length === 0) loadAvailablePhotos() }}
                    className={isV5 ? 'v5-btn v5-btn-sm' : 'v22-btn v22-btn-sm'}
                    disabled={photosLoading}
                  >
                    {photosLoading ? (isPt ? 'A carregar...' : 'Chargement...') : showPhotoPicker ? (locale === 'pt' ? '✕ Fechar' : '✕ Fermer') : (locale === 'pt' ? '+ Adicionar fotos' : '+ Ajouter des photos')}
                  </button>
                </div>
                <div className={isV5 ? '' : 'v22-card-body'} style={{ padding: '14px' }}>
                  {/* Photos deja liees */}
                  {linkedPhotos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {linkedPhotos.map(photoId => {
                        const photo = availablePhotos.find(p => p.id === photoId)
                        return (
                          <div key={photoId} style={{ position: 'relative' }}>
                            {photo ? (
                              <Image src={photo.url || ''} alt={isPt ? 'Foto da obra' : 'Photo chantier'} width={80} height={80} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: `2px solid ${tv.green}` }} unoptimized />
                            ) : (
                              <div style={{ width: '80px', height: '80px', background: tv.bg, borderRadius: '6px', border: `2px solid ${tv.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: tv.textMuted }}>📸</div>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePhotoLink(photoId)}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', background: tv.red, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                            {photo?.lat && photo?.lng && (
                              <div style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '1px 4px', borderRadius: '3px' }}>GPS</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {linkedPhotos.length === 0 && !showPhotoPicker && (
                    <p className={isV5 ? '' : 'v22-card-meta'} style={{ fontStyle: 'italic' }}>{isPt
                      ? 'Nenhuma foto associada. Adicione fotos da obra para as incluir no relatório.'
                      : 'Aucune photo liee. Ajoutez des photos chantier pour les inclure dans le rapport.'}</p>
                  )}

                  {/* Picker — grille de photos disponibles */}
                  {showPhotoPicker && (
                    <div style={{ background: tv.bg, borderRadius: '6px', padding: '10px', marginTop: '8px' }}>
                      {photosLoading ? (
                        <div className={isV5 ? '' : 'v22-card-meta'} style={{ textAlign: 'center', padding: '16px' }}>{isPt ? 'A carregar as fotos...' : 'Chargement des photos...'}</div>
                      ) : availablePhotos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>📸</div>
                          <p className={isV5 ? '' : 'v22-card-meta'}>{isPt ? 'Nenhuma foto da obra disponível' : 'Aucune photo chantier disponible'}</p>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '2px' }}>{isPt ? 'Tire fotos a partir da aplicação móvel' : <>Prenez des photos depuis l&apos;app mobile</>}</p>
                        </div>
                      ) : (
                        <>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginBottom: '8px' }}>{isPt ? 'Clique para selecionar / desmarcar:' : 'Cliquez pour selectionner / deselectionner :'}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', maxHeight: '192px', overflowY: 'auto' }}>
                            {availablePhotos.map(photo => {
                              const isLinked = linkedPhotos.includes(photo.id)
                              return (
                                <button
                                  type="button"
                                  key={photo.id}
                                  onClick={() => togglePhotoLink(photo.id)}
                                  style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: isLinked ? `2px solid ${tv.green}` : `2px solid ${tv.border}`, cursor: 'pointer', padding: 0, background: 'none' }}
                                >
                                  <Image src={photo.url || ''} alt="" width={100} height={64} style={{ width: '100%', height: '64px', objectFit: 'cover', display: 'block' }} unoptimized />
                                  {isLinked && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ background: tv.green, color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                                    </div>
                                  )}
                                  <div style={{ fontSize: '8px', color: tv.textMuted, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {new Date(photo.taken_at).toLocaleDateString(dateFmtLocale)}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginTop: '8px', textAlign: 'right' }}>{isPt
                            ? <>{linkedPhotos.length} foto{linkedPhotos.length > 1 ? 's' : ''} selecionada{linkedPhotos.length > 1 ? 's' : ''}</>
                            : <>{linkedPhotos.length} photo{linkedPhotos.length > 1 ? 's' : ''} selectionnee{linkedPhotos.length > 1 ? 's' : ''}</>}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={isV5 ? '' : 'v22-modal-foot'}>
              <button onClick={() => setShowForm(false)} className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1 }}>
                {isPt ? 'Cancelar' : 'Annuler'}
              </button>
              <button onClick={saveForm} disabled={!form.clientName || !form.interventionDate || !form.motif}
                className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'} style={{ flex: 1, opacity: (!form.clientName || !form.interventionDate || !form.motif) ? 0.5 : 1 }}>
                {isPt ? (editingId ? 'Atualizar' : 'Criar relatório') : (editingId ? 'Mettre a jour' : 'Creer le rapport')}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── Compteurs ── */}
      {rapports.length > 0 && (
        <div className={isV5 ? 'v5-kpi-g' : 'v22-stats'} style={isV5 ? { gridTemplateColumns: 'repeat(3, 1fr)' } : undefined}>
          <div className={isV5 ? 'v5-kpi' : 'v22-stat'}>
            <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Total de relatórios' : 'Total rapports'}</div>
            <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'}>{rapports.length}</div>
          </div>
          <div className={isV5 ? 'v5-kpi' : 'v22-stat'} style={isV5 ? { borderLeft: '3px solid #4CAF50' } : undefined}>
            <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Enviados' : 'Envoyés'}</div>
            <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: '#4CAF50' }}>{rapports.filter(r => r.sentStatus === 'envoye').length}</div>
          </div>
          <div className={isV5 ? 'v5-kpi' : 'v22-stat'} style={isV5 ? { borderLeft: '3px solid #FF9800' } : undefined}>
            <div className={isV5 ? 'v5-kpi-l' : 'v22-stat-label'}>{isPt ? 'Não enviados' : 'Non envoyés'}</div>
            <div className={isV5 ? 'v5-kpi-v' : 'v22-stat-val'} style={{ color: '#FF9800' }}>{rapports.filter(r => r.sentStatus !== 'envoye').length}</div>
          </div>
        </div>
      )}

      {/* ── Rapport list ── */}
      <div style={{ padding: '14px' }}>
        {rapports.length === 0 ? (
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
            <div className={isV5 ? 'v5-st' : 'v22-card-title'} style={{ marginBottom: '6px' }}>{isPt ? 'Sem relatórios' : 'Aucun rapport'}</div>
            <p className={isV5 ? '' : 'v22-card-meta'} style={{ marginBottom: '16px' }}>{isPt
              ? (isBtp ? 'Crie o seu primeiro relatório de obra' : 'Crie o seu primeiro relatório de intervenção')
              : <>Creez votre premier rapport d&apos;intervention BTP</>}</p>
            <button onClick={openNew} className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-primary'}>
              {isPt ? 'Criar relatório' : 'Creer un rapport'}
            </button>
          </div>
        ) : (
          <div className={isV5 ? 'v5-card' : 'v22-card'}>
            <div className={isV5 ? '' : 'v22-card-head'}>
              <span className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Relatórios' : 'Rapports'} ({rapports.length})</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{isPt ? 'Ref.' : 'Ref'}</th>
                  <th>{isPt ? 'Cliente' : 'Client'}</th>
                  <th>{isPt ? 'Motivo' : 'Motif'}</th>
                  <th>{isPt ? 'Data' : 'Date'}</th>
                  <th style={{ textAlign: 'center' }}>{isPt ? 'Estado' : 'Statut'}</th>
                  <th style={{ textAlign: 'center' }}>{isPt ? 'Envio' : 'Envoi'}</th>
                  <th style={{ textAlign: 'right' }}>{isPt ? 'Ações' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {rapports.map(r => (
                  <RapportTableRow
                    key={r.id}
                    rapport={r}
                    artisanId={artisan?.id}
                    documentsParId={documentsParId}
                    orgRole={orgRole}
                    dateFmtLocale={dateFmtLocale}
                    onEdit={openEdit}
                    onDelete={deleteRapport}
                    onGeneratePDF={handleGeneratePDF}
                    onMarkSent={markRapportSent}
                    pdfLoading={pdfLoading}
                    onNavigate={onNavigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hidden PDF Template ── */}
      {previewRapport && (
        <RapportPDFPreview
          ref={pdfRef}
          previewRapport={previewRapport}
          availablePhotos={availablePhotos}
          artisanId={artisan?.id}
          documentsParId={documentsParId}
          orgRole={orgRole}
          dateFmtLocale={dateFmtLocale}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
