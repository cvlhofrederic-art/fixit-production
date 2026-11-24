'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { adresseComplete, geocoderAdresse, type AdresseChantier } from '@/lib/btp/geocodage'
import {
  avertissementPositionGardee, champsModifies, porteLaPositionEnregistree, questionGarderPosition, questionPositionNecessaire,
  questionRetirerPosition,
} from '@/lib/btp/fiche-chantier'
import { confirmationRelocaliser } from '@/components/dashboard/btp/pointage/textes'
import { COLONNES_LIEU_DEVIS, champsAdresseDuLieu, libelleChoixDevis, lieuDuDevis, messageAdresseImportee } from '@/lib/btp/lieu-devis'
import { supabase } from '@/lib/supabase'
import type { Artisan } from '@/lib/types'
import { toast } from 'sonner'
import {
  PlusCircle, Pencil, Trash2, HardHat, MapPin, Calendar,
  User, Euro, FileText, CheckCircle2, AlertTriangle, AlertCircle,
  Siren, Clock, Satellite, Loader2, Users,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIERS BTP V2 — Supabase + Géoloc + Devis import + Rentabilité
// ═══════════════════════════════════════════════════════════════════════════════

interface ChantierForm {
  titre: string; client: string; adresse: string
  ville: string; codePostal: string
  dateDebut: string; dateFin: string; budget: string
  statut: string; description: string; equipe: string
  latitude?: number | null; longitude?: number | null
  geoRayonM: number
  devis_id?: string | null
  membres_ids?: string[]
}

const EMPTY_FORM: ChantierForm = {
  titre: '', client: '', adresse: '', ville: '', codePostal: '',
  dateDebut: '', dateFin: '',
  budget: '', statut: 'En attente', description: '', equipe: '',
  latitude: null, longitude: null, geoRayonM: 100,
  devis_id: null, membres_ids: [],
}

/**
 * Adresse modifiée : une position calculée pendant la saisie (bouton GPS, devis importé) ne correspond plus (le bouton
 * GPS la recalcule). La position enregistrée du chantier, elle, reste jusqu'à l'enregistrement (lib/btp/fiche-chantier.ts).
 */
const SANS_POSITION = { latitude: null, longitude: null } as const

interface DevisSummary {
  id: string; numero: string; client_name: string; client_address: string
  total_ht_cents: number; items: Array<{ description: string; [k: string]: unknown }>; created_at: string; status: string
  execution_delay_days?: number; prestation_date?: string
  /** Lieu d'intervention et adresse du client tirés du contenu du devis (COLONNES_LIEU_DEVIS, lib/btp/lieu-devis.ts). */
  lieu_intervention?: string | null; adresse_client_devis?: string | null
}

/**
 * Colonnes des devis proposés à l'import, avec COLONNES_LIEU_DEVIS. Repli, si la base n'a pas la colonne raw_data :
 * l'ancienne colonne client_address (que la synchronisation n'écrit plus : demandée seulement là).
 */
const COLONNES_DEVIS_IMPORT = 'id, numero, client_name, total_ht_cents, items, created_at, status'

interface MembreSummary {
  id: string; prenom: string; nom: string; role: string
  daily_cost: number; actif: boolean
}

function fmt(n: number, l: string) { return n.toLocaleString(l, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

/**
 * Statut enregistré d'un devis ou d'une facture (anglais ou français selon l'origine), affiché en portugais :
 * [orçamento (masculin), fatura (féminin)]. La valeur enregistrée ne change pas ; un statut inconnu s'affiche tel quel.
 */
const STATUT_DOCUMENT_PT: Record<string, [string, string]> = {
  draft: ['Rascunho', 'Rascunho'], brouillon: ['Rascunho', 'Rascunho'],
  sent: ['Enviado', 'Enviada'], envoye: ['Enviado', 'Enviada'], envoyé: ['Enviado', 'Enviada'],
  pending: ['Pendente', 'Pendente'],
  accepted: ['Aceite', 'Aceite'], accepte: ['Aceite', 'Aceite'], accepté: ['Aceite', 'Aceite'],
  signed: ['Assinado', 'Assinada'], signe: ['Assinado', 'Assinada'], signé: ['Assinado', 'Assinada'],
  rejected: ['Recusado', 'Recusada'], refuse: ['Recusado', 'Recusada'], refusé: ['Recusado', 'Recusada'],
  cancelled: ['Anulado', 'Anulada'], annule: ['Anulado', 'Anulada'], annulé: ['Anulado', 'Anulada'],
  paid: ['Pago', 'Paga'], payee: ['Pago', 'Paga'], payée: ['Pago', 'Paga'],
  overdue: ['Em atraso', 'Em atraso'], en_retard: ['Em atraso', 'Em atraso'],
  refunded: ['Reembolsado', 'Reembolsada'], rembourse: ['Reembolsado', 'Reembolsada'],
}
const statutDocumentPt = (statut: string, type: 'devis' | 'facture') => STATUT_DOCUMENT_PT[statut]?.[type === 'facture' ? 1 : 0] ?? statut

/** Fonction par défaut d'un membre lu sans rôle (« Ouvrier »), affichée en portugais. */
const ROLE_PT: Record<string, string> = { Ouvrier: 'Operário' }

// ── Status badge mapping ──
const STATUS_BADGE: Record<string, string> = {
  'En cours': 'v5-badge v5-badge-blue',
  'Terminé': 'v5-badge v5-badge-green',
  'En attente': 'v5-badge v5-badge-yellow',
  'Annulé': 'v5-badge v5-badge-red',
}

// ── Progress bar color by advancement ──
function progressColor(pct: number, statut: string): string {
  if (statut === 'Terminé') return '#4CAF50'
  if (statut === 'Annulé') return '#9E9E9E'
  if (pct >= 70) return '#66BB6A'
  if (pct >= 40) return '#42A5F5'
  if (pct >= 20) return '#FFA726'
  return '#FFCA28'
}

export function ChantiersBTPV2({ artisan, orgRole }: { artisan: Artisan; orgRole?: string }) {
  const isV5 = orgRole === 'pro_societe'
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dl = isPt ? 'pt-PT' : 'fr-FR'

  const { items: chantiers, loading, add, update, remove } = useBTPData({
    table: 'chantiers',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
  })
  const { settings } = useBTPSettings()

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'En attente' | 'Terminés'>('Tous')
  const [form, setForm] = useState<ChantierForm>(EMPTY_FORM)
  /** Fiche telle qu'ouverte pour modification : repère des champs modifiés et de la position enregistrée. */
  const ficheOuverteRef = useRef<ChantierForm | null>(null)
  /** Numéro de la dernière demande de géocodage : une réponse dépassée (adresse retouchée, autre fiche ouverte) est ignorée. */
  const demandeGeoRef = useRef(0)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  // Devis + Membres pour l'import
  const [devisList, setDevisList] = useState<DevisSummary[]>([])
  const [membresList, setMembresList] = useState<MembreSummary[]>([])
  const [loadingDevis, setLoadingDevis] = useState(false)
  /** Liste des devis ouverte sous « Adresse du chantier » (bouton « Importer depuis un devis »). */
  const [choixAdresseOuvert, setChoixAdresseOuvert] = useState(false)

  // Alerte fin de chantier
  const [prolongModal, setProlongModal] = useState<{ chantier: ChantierForm & { id: string; statut?: string } } | null>(null)
  const [prolongDays, setProlongDays] = useState(2)

  // Confirmation suppression
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Liaison devis/factures
  const [linkedDocs, setLinkedDocs] = useState<Record<string, Array<{id: string, type: 'devis'|'facture', numero: string, client_name: string, total_ht: number|null, status: string}>>>({})
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null)
  const [availableDevis, setAvailableDevis] = useState<Array<{id: string, numero: string, client_name: string, total_ht: number|null, status: string}>>([])

  // Search
  const [search, setSearch] = useState('')

  // ── Fetch devis + membres quand le modal s'ouvre ──
  const loadDevisAndMembres = useCallback(async () => {
    setLoadingDevis(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      const devisRequete = (colonnes: string) => supabase.from('devis').select(colonnes).eq('artisan_id', artisan?.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50)
      const [lectureAvecLieu, membresRes] = await Promise.all([
        devisRequete(`${COLONNES_DEVIS_IMPORT}, ${COLONNES_LIEU_DEVIS}`),
        fetch('/api/btp?table=membres', { headers }),
      ])
      const devisRes = lectureAvecLieu.error ? await devisRequete(`${COLONNES_DEVIS_IMPORT}, client_address`) : lectureAvecLieu
      if (devisRes.data) setDevisList(devisRes.data as unknown as DevisSummary[])
      if (membresRes.ok) {
        const j = await membresRes.json()
        const membres = (j.membres || []).filter((m: { actif?: boolean; prenom?: string; nom?: string; role?: string; daily_cost?: number }) => m.actif !== false)
        // Calculer le coût journalier via payroll engine
        const { calculateEmployeeCost } = await import('@/lib/payroll/engine')
        const country = (settings.country || 'FR') as 'FR' | 'PT'
        const companyType = settings.company_type || settings.statut_juridique || (country === 'FR' ? 'sarl' : 'lda')
        const mapped: MembreSummary[] = membres.map((m: { actif?: boolean; prenom?: string; nom?: string; role?: string; poste?: string; salaire_net_mensuel?: number; salaire_net?: number; heures_hebdo?: number; panier_repas_jour?: number; indemnite_trajet_jour?: number; prime_mensuelle?: number; charges_salariales_pct?: number; charges_patronales_pct?: number; cout_horaire?: number; id: string }) => {
          const netSalary = m.salaire_net_mensuel || m.salaire_net || 0
          let dailyCost = 0
          if (netSalary > 0) {
            const b = calculateEmployeeCost({
              country, company_type: companyType, net_salary: netSalary,
              heures_hebdo: m.heures_hebdo || 35,
              panier_repas_jour: m.panier_repas_jour || 0,
              indemnite_trajet_jour: m.indemnite_trajet_jour || 0,
              prime_mensuelle: m.prime_mensuelle || 0,
              overrides: {
                employee_charge_rate: m.charges_salariales_pct ? m.charges_salariales_pct / 100 : undefined,
                employer_charge_rate: m.charges_patronales_pct ? m.charges_patronales_pct / 100 : undefined,
              },
            })
            dailyCost = b.cost_per_day
          } else {
            const ch = m.cout_horaire || settings.cout_horaire_ouvrier || 15
            const cp = (m.charges_patronales_pct || settings.charges_patronales_pct || 45) / 100
            dailyCost = ch * (1 + cp) * 7
          }
          return {
            id: m.id, prenom: m.prenom || '', nom: m.nom || '',
            role: m.role || m.poste || 'Ouvrier',
            daily_cost: Math.round(dailyCost * 100) / 100,
            actif: m.actif !== false,
          }
        })
        setMembresList(mapped)
      }
    } catch (e) { console.error('loadDevisAndMembres:', e) }
    setLoadingDevis(false)
  }, [artisan?.id, settings])

  // ── Géocode ──
  // La position GPS déclenche le pointage automatique des employés : seule une position précise de l'adresse (numéro,
  // rue, commune vérifiée) est retenue. Une adresse trop vague retire une position calculée plutôt que d'en garder une
  // ancienne ; la position enregistrée du chantier (peut-être placée sur place), elle, est gardée (`garderSiImprecis`).
  const geocodeAdresse = useCallback(async (adresse: AdresseChantier, garderSiImprecis = false) => {
    if (!adresseComplete(adresse)) return
    demandeGeoRef.current += 1
    const demande = demandeGeoRef.current
    setGeocoding(true)
    try {
      const position = await geocoderAdresse(adresse, isPt ? 'PT' : 'FR')
      if (demande !== demandeGeoRef.current) return
      if (position?.precise) {
        setForm(f => ({ ...f, latitude: position.latitude, longitude: position.longitude }))
      } else if (position && garderSiImprecis) {
        toast.warning(avertissementPositionGardee(isPt))
      } else if (position) {
        // Centre de la commune, rue d'une autre commune : le pointage automatique se déclencherait au mauvais endroit.
        setForm(f => ({ ...f, latitude: null, longitude: null }))
        toast.warning(isPt ? 'Morada pouco precisa para o GPS: indique o número, a rua e o código postal.' : 'Adresse trop vague pour le GPS : indiquez le numéro, la rue et le code postal.')
      } else {
        toast.warning(isPt ? 'Morada não encontrada (ou serviço indisponível): posição GPS não atualizada.' : 'Adresse introuvable (ou service indisponible) : position GPS non mise à jour.')
      }
    } finally {
      if (demande === demandeGeoRef.current) setGeocoding(false)
    }
  }, [isPt])

  /** Géocodage en cours devenu sans objet (adresse retouchée, fiche ouverte ou rouverte) : sa réponse sera ignorée. */
  const oublierGeocodage = () => {
    demandeGeoRef.current += 1
    setGeocoding(false)
  }

  // ── Import devis → form ──
  const importDevis = (devis: DevisSummary) => {
    const items = typeof devis.items === 'string' ? JSON.parse(devis.items) : (devis.items || [])
    const firstDesc = items[0]?.description || ''
    const totalHT = devis.total_ht_cents / 100

    // Estimer les jours à partir du devis
    const delayDays = (devis as any).execution_delay_days || 0
    const today = new Date().toISOString().split('T')[0]
    let dateFin = ''
    if (delayDays > 0) {
      const end = new Date()
      end.setDate(end.getDate() + delayDays)
      dateFin = end.toISOString().split('T')[0]
    }

    // Adresse : le lieu d'intervention du devis (à défaut l'adresse du client), en rue, code postal et ville. Nouvelle
    // adresse : la position d'un devis importé avant ne doit pas rester. Un devis sans l'un ni l'autre laisse une adresse
    // tapée à la main, mais retire celle d'un devis importé avant (et sa position) : elle n'est pas celle de ce devis.
    const lieu = lieuDuDevis(devis)
    const champs = lieu ? champsAdresseDuLieu(lieu.texte, isPt ? 'PT' : 'FR') : null
    let adresse: Partial<ChantierForm> = {}
    if (champs) adresse = { ...champs, ...SANS_POSITION }
    else if (form.devis_id) adresse = { adresse: '', codePostal: '', ville: '', ...SANS_POSITION }
    if (Object.keys(adresse).length > 0) oublierGeocodage()
    setForm(f => ({
      ...f,
      titre: firstDesc || `${isPt ? 'Orçamento' : 'Devis'} ${devis.numero}`,
      client: devis.client_name || '',
      ...adresse,
      budget: String(totalHT),
      devis_id: devis.id,
      dateDebut: (devis as any).prestation_date || today,
      dateFin: dateFin || f.dateFin,
      description: `${isPt ? 'Ref. orçamento' : 'Réf. devis'}: ${devis.numero}\n${items.map((it: { description: string }) => `• ${it.description}`).join('\n')}`,
    }))

    // Géocoder le lieu d'intervention importé. L'adresse du client (peut-être un siège) ne l'est pas d'office : la
    // position déclenche le pointage ; le gérant la vérifie, puis utilise le bouton GPS.
    if (lieu && champs) {
      toast.success(messageAdresseImportee(devis.numero, lieu, champs, isPt))
      if (lieu.source === 'intervention') void geocodeAdresse(champs)
    } else {
      toast.warning(isPt
        ? 'Este orçamento não tem local de intervenção nem morada do cliente: indique a morada da obra.'
        : 'Ce devis n’a ni lieu d’intervention ni adresse du client : indiquez l’adresse du chantier.')
    }
  }

  // ── Bouton « Importer l'adresse depuis un devis » (création et modification) ──
  const devisAvecLieu = useMemo(() => devisList.filter(d => lieuDuDevis(d)), [devisList])

  /** Devis rattachés à la fiche ouverte : celui qui l'a créée (devis_id) et ceux liés au chantier (bouton Lier). */
  const devisDeLaFiche = (f: ChantierForm): Set<string> => new Set([
    ...(f.devis_id ? [f.devis_id] : []),
    ...(editId ? (linkedDocs[editId] ?? []).filter(d => d.type === 'devis').map(d => d.id) : []),
  ])

  /**
   * Reprend dans la fiche l'adresse d'un devis, rien d'autre. Comme une saisie dans l'adresse : la position enregistrée
   * du chantier reste (l'enregistrement demandera quoi en faire), sinon la position est recalculée pour un lieu
   * d'intervention (pas pour l'adresse du client, voir importDevis).
   */
  const importerAdresseDevis = (devis: DevisSummary) => {
    const lieu = lieuDuDevis(devis)
    if (!lieu) return
    const champs = champsAdresseDuLieu(lieu.texte, isPt ? 'PT' : 'FR')
    const garde = portePositionEnregistree(form)
    oublierGeocodage()
    setForm({ ...form, ...(garde ? {} : SANS_POSITION), ...champs })
    setChoixAdresseOuvert(false)
    toast.success(messageAdresseImportee(devis.numero, lieu, champs, isPt))
    if (!garde && lieu.source === 'intervention') void geocodeAdresse(champs)
  }

  /** Devis proposés par le bouton, ceux rattachés à la fiche en tête (tri stable : le plus récent d'abord ensuite). */
  const choixDevisAdresse = (f: ChantierForm) => {
    const rattaches = devisDeLaFiche(f)
    return devisAvecLieu
      .flatMap(devis => {
        const lieu = lieuDuDevis(devis)
        return lieu ? [{ devis, lieu, rattache: rattaches.has(devis.id) }] : []
      })
      .sort((a, b) => Number(b.rattache) - Number(a.rattache))
  }

  /**
   * Adresse vide et un seul devis rattaché à la fiche, avec un lieu : import direct. Sinon la liste des devis s'ouvre
   * (devis rattachés en tête) : une adresse déjà là ne se remplace pas sans choix, et un autre devis reste possible.
   */
  const clicImporterAdresse = () => {
    if (choixAdresseOuvert) { setChoixAdresseOuvert(false); return }
    const rattaches = devisDeLaFiche(form)
    const lies = devisAvecLieu.filter(d => rattaches.has(d.id))
    const adresseVide = [form.adresse, form.codePostal, form.ville].every(v => !(v ?? '').trim())
    if (adresseVide && lies.length === 1) { importerAdresseDevis(lies[0]); return }
    if (devisAvecLieu.length === 0) {
      toast.warning(isPt ? 'Nenhum orçamento com local de intervenção ou morada do cliente.' : 'Aucun devis avec un lieu d’intervention ou une adresse du client.')
      return
    }
    setChoixAdresseOuvert(true)
  }

  /** La fiche porte encore la position enregistrée du chantier (fiche ouverte pour modification seulement). */
  const portePositionEnregistree = (f: ChantierForm) => porteLaPositionEnregistree(editId ? ficheOuverteRef.current : null, f)

  /**
   * Saisie dans l'adresse (rue, code postal, ville) : un géocodage en cours devient sans objet ; la position enregistrée
   * reste (l'enregistrement demandera quoi en faire), une position calculée pendant la saisie part.
   */
  const saisirAdresse = (champ: Pick<ChantierForm, 'adresse'> | Pick<ChantierForm, 'codePostal'> | Pick<ChantierForm, 'ville'>) => {
    oublierGeocodage()
    setForm({ ...form, ...(portePositionEnregistree(form) ? {} : SANS_POSITION), ...champ })
  }

  /** Bouton GPS de la fiche : remplacer la position enregistrée (peut-être posée sur place) se confirme d'abord. */
  const localiserFiche = () => {
    const garde = portePositionEnregistree(form)
    if (garde && !window.confirm(confirmationRelocaliser(form.titre.trim() || '—', isPt))) return
    void geocodeAdresse(form, garde)
  }

  // ── Save ──
  const handleSave = async () => {
    if (!form.titre.trim()) return
    const ouverte = editId ? ficheOuverteRef.current : null
    let fiche = form
    // Adresse corrigée alors que la fiche porte la position enregistrée (peut-être placée sur le chantier) : la garder ?
    // La retirer demande un second OK ; fermer une boîte (Échap, Retour) ramène à la fiche sans rien enregistrer.
    if (questionPositionNecessaire(ouverte, form) && !window.confirm(questionGarderPosition(form.titre, isPt))) {
      if (!window.confirm(questionRetirerPosition(form.titre, isPt))) return
      fiche = { ...form, ...SANS_POSITION }
    }
    setSaving(true)
    // En cas d'échec, le hook affiche la raison ; la fenêtre et la saisie restent pour réessayer (rien n'est perdu).
    let enregistre: boolean
    if (editId) {
      // Seuls les champs modifiés depuis l'ouverture : une fiche ouverte avant un changement fait ailleurs (position
      // placée sur place, rayon ou employés de l'onglet Affectations) ne le défait plus.
      // Rien de modifié : rien à envoyer, la fenêtre se ferme.
      const modifies = ouverte ? champsModifies(ouverte, fiche) : fiche
      enregistre = Object.keys(modifies).length === 0 || await update(editId, modifies)
    } else {
      enregistre = (await add(fiche)) !== null
    }
    setSaving(false)
    if (!enregistre) return
    setShowModal(false); setEditId(null); setForm(EMPTY_FORM)
  }

  const handleEdit = (c: ChantierForm & { id: string }) => {
    oublierGeocodage()
    setEditId(c.id)
    const fiche: ChantierForm = {
      titre: c.titre, client: c.client, adresse: c.adresse,
      ville: c.ville || '', codePostal: c.codePostal || '',
      dateDebut: c.dateDebut, dateFin: c.dateFin, budget: c.budget,
      statut: c.statut, description: c.description, equipe: c.equipe,
      latitude: c.latitude, longitude: c.longitude, geoRayonM: c.geoRayonM || 100,
      devis_id: c.devis_id || null, membres_ids: c.membres_ids || [],
    }
    ficheOuverteRef.current = fiche
    setForm(fiche)
    setChoixAdresseOuvert(false)
    setShowModal(true)
    loadDevisAndMembres()
  }

  const handleDelete = async (id: string) => {
    await remove(id)
    setDeleteConfirm(null)
  }

  const changeStatut = async (id: string, statut: string): Promise<boolean> => {
    return update(id, { statut } as any)
  }

  // ── Prolongation ──
  const handleProlong = async () => {
    if (!prolongModal) return
    const c = prolongModal.chantier
    const newEnd = new Date(c.dateFin)
    newEnd.setDate(newEnd.getDate() + prolongDays)
    // Fenêtre gardée si la prolongation n'est pas enregistrée (le hook en affiche la raison).
    if (await update(c.id, { dateFin: newEnd.toISOString().split('T')[0] } as any)) setProlongModal(null)
  }

  // ── Rentabilité par chantier ──
  const getRenta = useCallback((c: ChantierForm & { id: string; statut?: string }) => {
    const budget = Number(c.budget) || 0
    if (!budget || !c.dateDebut || !c.dateFin) return null

    const d0 = new Date(c.dateDebut)
    const d1 = new Date(c.dateFin)
    const now = new Date()
    const joursPrevu = Math.max(1, Math.ceil((d1.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)))

    // Jours écoulés (si en cours)
    const joursEcoules = c.statut === 'En cours'
      ? Math.max(0, Math.ceil((now.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24)))
      : c.statut === 'Terminé' ? joursPrevu : 0

    // Coût MO par jour (employés assignés ou moyenne)
    const membresIds: string[] = c.membres_ids || []
    const membresAssignes = membresIds.length > 0
      ? membresList.filter(m => membresIds.includes(m.id))
      : []
    const nbEmployes = membresAssignes.length || Number(c.equipe) || 1
    const coutMOJour = membresAssignes.length > 0
      ? membresAssignes.reduce((s, m) => s + m.daily_cost, 0)
      : nbEmployes * (settings.cout_horaire_ouvrier || 15) * (1 + (settings.charges_patronales_pct || 45) / 100) * 7

    const marginPct = settings.objectif_marge_pct || 30
    const materiauxPct = 15 // 15% du budget pour matériaux
    const coutMateriaux = budget * materiauxPct / 100
    const coutMOTotal = coutMOJour * joursPrevu
    const coutTotal = coutMOTotal + coutMateriaux
    const beneficePrevu = budget - coutTotal
    const margePrevu = budget > 0 ? (beneficePrevu / budget) * 100 : 0

    // Retard
    const enRetard = c.statut === 'En cours' && joursEcoules > joursPrevu
    const joursRetard = enRetard ? joursEcoules - joursPrevu : 0
    const perteParJourRetard = coutMOJour
    const perteRetardTotal = joursRetard * perteParJourRetard
    const beneficeActuel = beneficePrevu - perteRetardTotal

    // Status
    const status: 'profit' | 'warning' | 'loss' =
      beneficeActuel > 0 && margePrevu >= 25 ? 'profit'
        : beneficeActuel > 0 ? 'warning'
          : 'loss'

    // Fin prévue dépassée ?
    const finDepassee = c.statut === 'En cours' && now > d1

    return {
      budget,
      joursPrevu,
      joursEcoules,
      nbEmployes,
      coutMOJour: Math.round(coutMOJour),
      coutMOTotal: Math.round(coutMOTotal),
      coutMateriaux: Math.round(coutMateriaux),
      coutTotal: Math.round(coutTotal),
      beneficePrevu: Math.round(beneficePrevu),
      margePrevu: Math.round(margePrevu * 10) / 10,
      enRetard,
      joursRetard,
      perteParJourRetard: Math.round(perteParJourRetard),
      perteRetardTotal: Math.round(perteRetardTotal),
      beneficeActuel: Math.round(beneficeActuel),
      status,
      finDepassee,
    }
  }, [membresList, settings])

  // ── Charger membres au mount ──
  useEffect(() => { loadDevisAndMembres() }, [loadDevisAndMembres])

  // ── Fetch linked docs (devis + factures with chantier_id set) ──
  const loadLinkedDocs = useCallback(async () => {
    if (!artisan?.id) return
    try {
      const [devisRes, facturesRes] = await Promise.all([
        supabase.from('devis').select('id, numero, client_name, total_ht_cents, status, chantier_id').eq('artisan_id', artisan.id).not('chantier_id', 'is', null).is('deleted_at', null),
        supabase.from('factures').select('id, numero, client_name, total_ht_cents, status, chantier_id').eq('artisan_id', artisan.id).not('chantier_id', 'is', null).is('deleted_at', null),
      ])
      const grouped: Record<string, Array<{id: string, type: 'devis'|'facture', numero: string, client_name: string, total_ht: number|null, status: string}>> = {}
      for (const d of (devisRes.data || [])) {
        const cid = (d as any).chantier_id as string
        if (!grouped[cid]) grouped[cid] = []
        grouped[cid].push({ id: d.id, type: 'devis', numero: d.numero || '', client_name: d.client_name || '', total_ht: d.total_ht_cents != null ? d.total_ht_cents / 100 : null, status: d.status || '' })
      }
      for (const f of (facturesRes.data || [])) {
        const cid = (f as any).chantier_id as string
        if (!grouped[cid]) grouped[cid] = []
        grouped[cid].push({ id: f.id, type: 'facture', numero: (f as any).numero || '', client_name: f.client_name || '', total_ht: f.total_ht_cents != null ? f.total_ht_cents / 100 : null, status: f.status || '' })
      }
      setLinkedDocs(grouped)
    } catch (e) { console.error('loadLinkedDocs:', e) }
  }, [artisan?.id])

  useEffect(() => { loadLinkedDocs() }, [loadLinkedDocs])

  // ── Open link modal: fetch unlinked devis ──
  const openLinkModal = useCallback(async (chantierId: string) => {
    setShowLinkModal(chantierId)
    try {
      const { data } = await supabase
        .from('devis')
        .select('id, numero, client_name, total_ht_cents, status')
        .eq('artisan_id', artisan?.id)
        .is('chantier_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      setAvailableDevis((data || []).map((d: any) => ({
        id: d.id,
        numero: d.numero || '',
        client_name: d.client_name || '',
        total_ht: d.total_ht_cents != null ? d.total_ht_cents / 100 : null,
        status: d.status || '',
      })))
    } catch (e) { console.error('openLinkModal:', e) }
  }, [artisan?.id])

  // ── Link a devis to a chantier ──
  const linkDevis = useCallback(async (devisId: string, chantierId: string) => {
    const { error } = await supabase.from('devis').update({ chantier_id: chantierId } as any).eq('id', devisId)
    if (error) {
      toast.error(isPt ? 'Erro ao associar o orçamento' : 'Erreur lors de la liaison')
    } else {
      toast.success(isPt ? 'Orçamento associado à obra' : 'Devis lié au chantier')
      setShowLinkModal(null)
      await loadLinkedDocs()
    }
  }, [loadLinkedDocs, isPt])

  // ── Filter + search ──
  const filtered = useMemo(() => {
    let list = filter === 'Tous'
      ? chantiers
      : chantiers.filter((c: ChantierForm & { id: string; statut?: string }) => filter === 'Terminés' ? c.statut === 'Terminé' : c.statut === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c: ChantierForm & { id: string }) =>
        c.titre.toLowerCase().includes(q) || c.client.toLowerCase().includes(q) || c.adresse.toLowerCase().includes(q)
      )
    }
    return list
  }, [chantiers, filter, search])

  // ── Compute advancement % ──
  function getAdvancement(c: ChantierForm & { id: string; statut?: string }): number {
    if (c.statut === 'Terminé') return 100
    if (c.statut === 'En attente' || c.statut === 'Annulé') return 0
    if (!c.dateDebut || !c.dateFin) return 0
    const d0 = new Date(c.dateDebut).getTime()
    const d1 = new Date(c.dateFin).getTime()
    const now = Date.now()
    if (d1 <= d0) return 0
    const pct = Math.round(((now - d0) / (d1 - d0)) * 100)
    return Math.max(0, Math.min(100, pct))
  }

  // ── Format date short ──
  function fmtDate(d: string): string {
    if (!d) return '—'
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
  }

  // ── Chef de chantier (first assigned member or —) ──
  function getChef(c: ChantierForm & { id: string }): string {
    const ids = c.membres_ids || []
    if (ids.length === 0) return '—'
    const m = membresList.find(mm => mm.id === ids[0])
    return m ? `${m.prenom.charAt(0)}. ${m.nom}` : '—'
  }

  // ── Counts for filter and subtitle ──
  const activeCount = chantiers.filter((c: ChantierForm & { statut?: string }) => c.statut === 'En cours').length
  const pendingCount = chantiers.filter((c: ChantierForm & { statut?: string }) => c.statut === 'En attente').length
  const doneCount = chantiers.filter((c: ChantierForm & { statut?: string }) => c.statut === 'Terminé').length

  if (loading) return (
    <div style={{ padding: '1.25rem', textAlign: 'center' }}>
      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
      <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div>
      {/* ── Page header ── */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <h1>{isPt ? 'Obras' : 'Chantiers'}</h1>
        <p>{isPt ? `Gestão das suas obras: ${activeCount} ativa(s)` : `Gestion de vos chantiers — ${activeCount} actif(s)`}</p>
      </div>

      {/* ── Search bar ── */}
      <div className={isV5 ? "v5-search" : "v22-search"}>
        <input
          className={isV5 ? "v5-search-in" : "v22-search-in"}
          placeholder={isPt ? 'Pesquisar uma obra…' : 'Rechercher un chantier…'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={isV5 ? "v5-filter-sel" : "v22-filter-sel"}
          value={filter}
          onChange={e => setFilter(e.target.value as typeof filter)}
        >
          <option value="Tous">{isPt ? 'Todas' : 'Tous'} ({chantiers.length})</option>
          <option value="En cours">{isPt ? 'Em curso' : 'En cours'} ({activeCount})</option>
          <option value="En attente">{isPt ? 'Pendentes' : 'En attente'} ({pendingCount})</option>
          <option value="Terminés">{isPt ? 'Concluídas' : 'Terminés'} ({doneCount})</option>
        </select>
        <button
          className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
          onClick={() => { oublierGeocodage(); setEditId(null); setForm(EMPTY_FORM); setChoixAdresseOuvert(false); setShowModal(true); void loadDevisAndMembres() }}
        >
          + {isPt ? 'Nova obra' : 'Nouveau chantier'}
        </button>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className={isV5 ? "v5-card" : "v22-card"} style={{ padding: '1.25rem', textAlign: 'center' }}>
          <HardHat size={40} style={{ margin: '0 auto 10px', color: '#BBB' }} />
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            {isPt ? 'Nenhuma obra' : 'Aucun chantier'}
          </div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
            {isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}
          </p>
          <button
            className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
            onClick={() => { oublierGeocodage(); setEditId(null); setForm(EMPTY_FORM); setChoixAdresseOuvert(false); setShowModal(true); void loadDevisAndMembres() }}
          >
            + {isPt ? 'Criar obra' : 'Créer un chantier'}
          </button>
        </div>
      ) : (
        <div className={isV5 ? "v5-card" : "v22-card"} style={{ overflowX: 'auto' }}>
          <table className={isV5 ? "v5-dt" : "v22-table"}>
            <thead>
              <tr>
                <th>{isPt ? 'Ref.' : 'Réf'}</th>
                <th>{isPt ? 'Obra' : 'Chantier'}</th>
                <th>{isPt ? 'Cliente' : 'Client'}</th>
                <th>{isPt ? 'Encarregado' : 'Chef'}</th>
                <th>{isPt ? 'Início' : 'Début'}</th>
                <th>{isPt ? 'Fim' : 'Fin'}</th>
                <th>{isPt ? 'Avanço' : 'Avanc.'}</th>
                <th>{isPt ? 'Estado' : 'Statut'}</th>
                <th>{isPt ? 'Valor' : 'Budget'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: ChantierForm & { id: string; statut?: string }, idx: number) => {
                const renta = getRenta(c)
                const pct = getAdvancement(c)
                const isLate = renta?.enRetard
                return (
                  <tr key={c.id}>
                    <td>CH-{String(idx + 1).padStart(3, '0')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: isLate ? '#C62828' : undefined }}>
                          {c.titre}{isLate ? ' ⚠️' : ''}
                        </span>
                        {c.latitude && <span className={isV5 ? "v5-badge v5-badge-green" : "v22-tag v22-tag-green"} style={{ fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 2 }}><MapPin size={9} /> GPS</span>}
                        {c.devis_id && <span className={isV5 ? "v5-badge v5-badge-blue" : "v22-tag v22-tag-blue"} style={{ fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 2 }}><FileText size={9} /> {isPt ? 'Orçamento' : 'Devis'}</span>}
                      </div>
                      {c.adresse && (
                        <div style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={9} /> {c.adresse}
                        </div>
                      )}
                    </td>
                    <td>{c.client || '—'}</td>
                    <td>
                      <div>{getChef(c)}</div>
                      {(c.membres_ids?.length ?? 0) > 1 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                          {(c.membres_ids as string[]).slice(1).map((mid: string) => {
                            const m = membresList.find(mm => mm.id === mid)
                            return m ? (
                              <span key={mid} className={isV5 ? "v5-badge v5-badge-gray" : "v22-tag v22-tag-gray"} style={{ fontSize: 9 }}>
                                {m.prenom.charAt(0)}. {m.nom}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </td>
                    <td>{fmtDate(c.dateDebut)}</td>
                    <td>{fmtDate(c.dateFin)}</td>
                    <td>
                      <div className={isV5 ? "v5-prog-row" : "v22-prog-row"}>
                        <div className={isV5 ? "v5-prog-bg" : "v22-prog-bg"}>
                          <div
                            className={isV5 ? "v5-prog-fill" : "v22-prog-fill"}
                            style={{ width: `${pct}%`, background: isLate ? '#EF5350' : progressColor(pct, c.statut || '') }}
                          />
                        </div>
                        <span className={isV5 ? "v5-prog-pct" : "v22-prog-pct"}>{pct}%</span>
                      </div>
                    </td>
                    <td>
                      <select
                        className={isV5 ? "v5-filter-sel" : "v22-filter-sel"}
                        style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600, minWidth: 90 }}
                        value={c.statut || 'En attente'}
                        onChange={e => changeStatut(c.id, e.target.value)}
                      >
                        {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => {
                          const sl: Record<string, string> = isPt
                            ? { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }
                            : { 'En attente': 'En attente', 'En cours': 'En cours', 'Terminé': 'Terminé', 'Annulé': 'Annulé' }
                          return <option key={s} value={s}>{sl[s]}</option>
                        })}
                      </select>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {c.budget ? `${Number(c.budget).toLocaleString(dl)} €` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => handleEdit(c)} aria-label={isPt ? 'Editar' : 'Modifier'}>
                          <Pencil size={12} />
                        </button>
                        <button className={isV5 ? "v5-btn v5-btn-sm v5-btn-d" : "v22-btn v22-btn-sm v22-btn-danger"} onClick={() => setDeleteConfirm(c.id)} aria-label={isPt ? 'Eliminar' : 'Supprimer'}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Devis et factures liés ── */}
          <div style={{ marginTop: 12 }}>
            {filtered.map((c: ChantierForm & { id: string; statut?: string }) => {
              const docs = linkedDocs[c.id] || []
              return (
                <div key={`linked-${c.id}`} style={{
                  marginBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, overflow: 'hidden', fontSize: 11,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', background: '#F5F5F5', borderBottom: docs.length > 0 ? '1px solid #E0E0E0' : undefined,
                  }}>
                    <span style={{ fontWeight: 600, color: '#444', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <FileText size={12} /> {c.titre}{isPt ? ': ' : ' — '}{isPt ? 'Documentos associados' : 'Devis et factures liés'}
                    </span>
                    <button
                      className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"}
                      style={{ fontSize: 10 }}
                      onClick={() => openLinkModal(c.id)}
                    >
                      + {isPt ? 'Associar orçamento' : 'Lier un devis'}
                    </button>
                  </div>
                  {docs.length === 0 ? (
                    <div style={{ padding: '6px 12px', color: '#999', fontStyle: 'italic' }}>
                      {isPt ? 'Nenhum documento associado' : 'Aucun document lié'}
                    </div>
                  ) : (
                    <div style={{ padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {docs.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span>{doc.type === 'devis' ? '📋' : '🧾'}</span>
                          <span style={{ fontWeight: 600 }}>{doc.numero}</span>
                          <span style={{ color: '#666' }}>{doc.client_name}</span>
                          {doc.total_ht != null && (
                            <span style={{ color: '#333' }}>{doc.total_ht.toLocaleString(dl)} €</span>
                          )}
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                            background: doc.status === 'sent' || doc.status === 'accepted' ? '#E8F5E9' : doc.status === 'draft' ? '#FFF8E1' : '#E3F2FD',
                            color: doc.status === 'sent' || doc.status === 'accepted' ? '#2E7D32' : doc.status === 'draft' ? '#F57F17' : '#1565C0',
                          }}>
                            {isPt ? statutDocumentPt(doc.status, doc.type) : doc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Rentabilité details below table ── */}
          {filtered.some((c: ChantierForm & { id: string; statut?: string }) => getRenta(c) !== null) && (
            <div style={{ marginTop: 12 }}>
              {filtered.map((c: ChantierForm & { id: string; statut?: string }) => {
                const renta = getRenta(c)
                if (!renta) return null
                const bgColor = renta.status === 'profit' ? '#E8F5E9' : renta.status === 'warning' ? '#FFF8E1' : '#FFEBEE'
                const borderColor = renta.status === 'profit' ? '#4CAF50' : renta.status === 'warning' ? '#FFC107' : '#EF5350'
                return (
                  <div key={`renta-${c.id}`} style={{
                    padding: '8px 12px', marginBottom: 6, borderRadius: 4,
                    background: bgColor, borderLeft: `3px solid ${borderColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                    fontSize: 11,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: renta.beneficeActuel >= 0 ? '#2E7D32' : '#C62828' }}>
                        {renta.status === 'profit' ? <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> : renta.status === 'warning' ? <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                        {' '}{c.titre}: {renta.beneficeActuel >= 0 ? '+' : ''}{fmt(renta.beneficeActuel, dl)} €
                      </span>
                      <span style={{ color: '#666' }}>
                        ({isPt ? 'Margem' : 'Marge'}: {renta.margePrevu}%)
                      </span>
                      <span style={{ color: '#666' }}>
                        {isPt ? 'Custo M.O.' : 'Coût M.O.'}: {fmt(renta.coutMOJour, dl)} €/{isPt ? 'dia' : 'j'} x {renta.joursPrevu}{isPt ? ' dias' : 'j'}
                      </span>
                    </div>

                    {renta.enRetard && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#C62828' }}>
                          <Siren size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {renta.joursRetard}{isPt ? ' dias de atraso' : 'j retard'} = -{fmt(renta.perteRetardTotal, dl)} €
                        </span>
                        <span style={{ color: '#E53935' }}>
                          (-{fmt(renta.perteParJourRetard, dl)} €/{isPt ? 'dia' : 'jour'})
                        </span>
                      </div>
                    )}

                    {renta.finDepassee && (
                      <button
                        className={isV5 ? "v5-btn v5-btn-sm v5-btn-d" : "v22-btn v22-btn-sm v22-btn-danger"}
                        onClick={() => { setProlongModal({ chantier: c }); setProlongDays(2) }}
                      >
                        <Clock size={12} /> {isPt ? 'Prolongar' : 'Prolonger'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════ MODAL PROLONGATION ══════ */}
      {prolongModal && (() => {
        const c = prolongModal.chantier
        const renta = getRenta(c)
        const newRenta = renta ? {
          ...renta,
          joursPrevu: renta.joursPrevu + prolongDays,
          coutMOTotal: renta.coutMOJour * (renta.joursPrevu + prolongDays),
          coutTotal: renta.coutMOJour * (renta.joursPrevu + prolongDays) + renta.coutMateriaux,
          beneficePrevu: renta.budget - (renta.coutMOJour * (renta.joursPrevu + prolongDays) + renta.coutMateriaux),
        } : null
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className={isV5 ? "v5-card" : "v22-card"} style={{ width: '100%', maxWidth: 480 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> {isPt ? 'A sua obra terminou?' : 'Votre chantier est-il fini ?'}
                </span>
                <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setProlongModal(null)}>✕</button>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ textAlign: 'center', fontSize: 13 }}>
                  <strong>{c.titre}</strong>{isPt ? ' · ' : ' — '}{isPt ? 'Previsto' : 'Prévu'}: {renta?.joursPrevu}{isPt ? ' dias' : ' jours'}
                </div>

                {/* Option 1: Clôturer */}
                <button
                  className={isV5 ? "v5-btn v5-btn-s" : "v22-btn v22-btn-secondary"}
                  style={{ width: '100%', padding: '10px 14px', justifyContent: 'center' }}
                  onClick={async () => { if (await changeStatut(c.id, 'Terminé')) setProlongModal(null) }}
                >
                  <CheckCircle2 size={14} /> {isPt ? 'Sim, encerrar a obra' : 'Oui, clôturer le chantier'}
                </button>

                {/* Option 2: Prolonger */}
                <div style={{ background: '#FFF8E1', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#F57F17', marginBottom: 8 }}>
                    {isPt ? 'Não, estimar dias suplementares:' : 'Non, estimer les jours supplémentaires :'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="number" min={1} max={60} value={prolongDays}
                      onChange={e => setProlongDays(Math.max(1, Number(e.target.value)))}
                      className={isV5 ? "v5-fi" : "v22-input"}
                      style={{ width: 80, textAlign: 'center', fontWeight: 600, fontSize: 14 }}
                    />
                    <span style={{ fontSize: 12, color: '#F57F17' }}>{isPt ? 'dias a mais' : 'jours de plus'}</span>
                  </div>

                  {/* Nouveau calcul */}
                  {newRenta && renta && (
                    <div className={isV5 ? "v5-fr" : "v22-form-row"} style={{ marginTop: 10, padding: 10, background: '#fff', borderRadius: 6 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#999' }}>{isPt ? 'Novo custo M.O.' : 'Nouveau coût M.O.'}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#C62828' }}>{fmt(newRenta.coutMOTotal, dl)} €</div>
                        <div style={{ fontSize: 10, color: '#C62828' }}>+{fmt(newRenta.coutMOTotal - renta.coutMOTotal, dl)} €</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#999' }}>{isPt ? 'Nova rentabilidade' : 'Nouvelle rentabilité'}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: newRenta.beneficePrevu >= 0 ? '#2E7D32' : '#C62828' }}>
                          {newRenta.beneficePrevu >= 0 ? '+' : ''}{fmt(newRenta.beneficePrevu, dl)} €
                        </div>
                        <div style={{ fontSize: 10, color: newRenta.beneficePrevu < renta.beneficePrevu ? '#C62828' : '#999' }}>
                          {fmt(newRenta.beneficePrevu - renta.beneficePrevu, dl)} €
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
                    style={{ width: '100%', marginTop: 10, padding: '8px 14px', justifyContent: 'center' }}
                    onClick={handleProlong}
                  >
                    <Calendar size={14} /> {isPt ? `Prolongar por ${prolongDays} dias` : `Prolonger de ${prolongDays} jours`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══════ MODAL CONFIRMATION SUPPRESSION ══════ */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? "v5-card" : "v22-card"} style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> {isPt ? 'Confirmar eliminação' : 'Confirmer la suppression'}
              </span>
              <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                {isPt ? 'Tem a certeza de que pretende eliminar esta obra?' : 'Voulez-vous vraiment supprimer ce chantier ?'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={isV5 ? "v5-btn" : "v22-btn"} style={{ flex: 1 }} onClick={() => setDeleteConfirm(null)}>
                  {isPt ? 'Cancelar' : 'Annuler'}
                </button>
                <button className={isV5 ? "v5-btn v5-btn-d" : "v22-btn v22-btn-danger"} style={{ flex: 1, fontWeight: 600 }} onClick={() => handleDelete(deleteConfirm)}>
                  {isPt ? 'Eliminar' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL CRÉATION/ÉDITION ══════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? "v5-card" : "v22-card"} style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <HardHat size={14} /> {editId ? (isPt ? 'Editar obra' : 'Modifier le chantier') : (isPt ? 'Nova obra' : 'Nouveau chantier')}
              </span>
              <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── Import devis ── */}
              {!editId && (
                <div style={{ background: '#E3F2FD', borderRadius: 6, padding: 12, border: '1px solid #90CAF9' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#1565C0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={12} /> {isPt ? 'Importar de um orçamento existente' : 'Importer depuis un devis existant'}
                  </div>
                  {loadingDevis ? (
                    <div style={{ fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Loader2 size={12} className="animate-spin" /> {isPt ? 'A carregar...' : 'Chargement...'}
                    </div>
                  ) : devisList.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#666' }}>{isPt ? 'Nenhum orçamento encontrado' : 'Aucun devis trouvé'}</div>
                  ) : (
                    <select
                      className={isV5 ? "v5-filter-sel" : "v22-filter-sel"}
                      style={{ width: '100%', fontSize: 11 }}
                      value=""
                      onChange={e => {
                        const devis = devisList.find(d => d.id === e.target.value)
                        if (devis) importDevis(devis)
                      }}
                    >
                      <option value="">{isPt ? 'Selecionar um orçamento...' : '— Sélectionner un devis —'}</option>
                      {devisList.map(d => (
                        <option key={d.id} value={d.id}>
                          {/* « ?? '' » : une valeur absente ne s'écrit pas, comme avant dans le JSX d'origine. */}
                          {isPt
                            ? `${d.numero ?? ''} · ${d.client_name ?? ''} · ${(d.total_ht_cents / 100).toLocaleString(dl)} € (${statutDocumentPt(d.status ?? '', 'devis')})`
                            : `${d.numero ?? ''} — ${d.client_name ?? ''} — ${(d.total_ht_cents / 100).toLocaleString(dl)} € (${d.status ?? ''})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className={isV5 ? "v5-fi" : "v22-input"} value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
                  placeholder={isPt ? 'ex.: Edifício R/C+3, estrutura' : 'ex: Immeuble R+3 — Gros oeuvre'} />
              </div>

              <div className={isV5 ? "v5-fr" : "v22-form-row"}>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Cliente / Dono de obra' : 'Client / Maître d\'ouvrage'}</label>
                  <input className={isV5 ? "v5-fi" : "v22-input"} value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Valor s/ IVA (€)' : 'Budget HT (€)'}</label>
                  <input type="number" className={isV5 ? "v5-fi" : "v22-input"} value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                </div>
              </div>

              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label htmlFor="chantier-adresse" className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                  <button type="button" className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={clicImporterAdresse}
                    disabled={loadingDevis} aria-expanded={choixAdresseOuvert}
                    title={isPt ? 'Local de intervenção do orçamento associado à obra, ou de outro orçamento' : 'Lieu d’intervention du devis rattaché au chantier, ou d’un autre devis'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    {loadingDevis ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {isPt ? 'Importar morada de um orçamento' : 'Importer l’adresse depuis un devis'}
                  </button>
                </div>
                {choixAdresseOuvert && (
                  <select
                    aria-label={isPt ? 'Orçamento cuja morada importar' : 'Devis dont reprendre l’adresse'}
                    className={isV5 ? "v5-filter-sel" : "v22-filter-sel"}
                    style={{ width: '100%', fontSize: 11, margin: '4px 0 6px' }}
                    value=""
                    onChange={e => {
                      const devis = devisAvecLieu.find(d => d.id === e.target.value)
                      if (devis) importerAdresseDevis(devis)
                    }}
                  >
                    <option value="">{isPt ? 'Selecionar um orçamento...' : '— Sélectionner un devis —'}</option>
                    {choixDevisAdresse(form).map(({ devis, lieu, rattache }) => (
                      <option key={devis.id} value={devis.id} title={lieu.texte}>
                        {rattache ? (isPt ? '★ Associado · ' : '★ Rattaché · ') : ''}{libelleChoixDevis(devis, lieu, isPt)}
                      </option>
                    ))}
                  </select>
                )}
                <input id="chantier-adresse" className={isV5 ? "v5-fi" : "v22-input"} value={form.adresse}
                  onChange={e => saisirAdresse({ adresse: e.target.value })}
                  placeholder={isPt ? 'Rua, n.º...' : 'N°, rue...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Código postal' : 'Code postal'}</label>
                  <input className={isV5 ? "v5-fi" : "v22-input"} value={form.codePostal}
                    onChange={e => saisirAdresse({ codePostal: e.target.value })}
                    placeholder={isPt ? '4000-123' : '13001'} maxLength={10} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Cidade *' : 'Ville *'}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className={isV5 ? "v5-fi" : "v22-input"} style={{ flex: 1 }} value={form.ville}
                      onChange={e => saisirAdresse({ ville: e.target.value })}
                      placeholder={isPt ? 'Porto, Lisboa...' : 'Marseille, Lyon...'} />
                    <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={localiserFiche}
                      disabled={geocoding || (!form.ville.trim() && !form.adresse.trim())}>
                      {geocoding ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                      {form.latitude ? <CheckCircle2 size={12} style={{ color: '#2E7D32' }} /> : ' GPS'}
                    </button>
                  </div>
                  {form.latitude && (
                    <div style={{ fontSize: 10, color: '#2E7D32', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle2 size={10} /> {isPt ? 'GPS:' : 'GPS :'} {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Raio do registo de ponto (GPS)' : 'Rayon pointage GPS'}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={25} max={500} step={25} value={form.geoRayonM}
                    onChange={e => setForm({ ...form, geoRayonM: Number(e.target.value) })}
                    style={{ flex: 1 }} />
                  <span style={{ fontWeight: 600, fontSize: 12, minWidth: 45, textAlign: 'right' }}>{form.geoRayonM}{isPt ? ' m' : 'm'}</span>
                </div>
              </div>

              <div className={isV5 ? "v5-fr" : "v22-form-row"}>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Data de início' : 'Date de début'}</label>
                  <input type="date" className={isV5 ? "v5-fi" : "v22-input"} value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} />
                </div>
                <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                  <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className={isV5 ? "v5-fi" : "v22-input"} value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} />
                </div>
              </div>

              {/* ── Équipe / Employés assignés ── */}
              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Colaboradores atribuídos' : 'Employés assignés'}</label>
                {membresList.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#999', padding: 6 }}>
                    {isPt ? 'Nenhum colaborador. Adicione-os em "Equipas".' : 'Aucun employé. Ajoutez-en dans "Équipes".'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 150, overflowY: 'auto', padding: 3 }}>
                    {membresList.map(m => {
                      const selected = (form.membres_ids || []).includes(m.id)
                      return (
                        <label key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                          background: selected ? '#E8F5E9' : '#fff', border: `1px solid ${selected ? '#81C784' : '#E0E0E0'}`,
                          fontSize: 12,
                        }}>
                          <input type="checkbox" checked={selected}
                            onChange={() => {
                              const ids = form.membres_ids || []
                              setForm({ ...form, membres_ids: selected ? ids.filter(id => id !== m.id) : [...ids, m.id] })
                            }} />
                          <span style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</span>
                          <span style={{ color: '#999' }}>{isPt ? ROLE_PT[m.role] ?? m.role : m.role}</span>
                          <span style={{ color: '#C62828', marginLeft: 'auto' }}>{m.daily_cost.toFixed(0)} €/{isPt ? 'dia' : 'j'}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {(form.membres_ids || []).length > 0 && (
                  <div style={{ fontSize: 10, color: '#2E7D32', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle2 size={10} /> {(form.membres_ids || []).length} {isPt ? 'colaborador(es) selecionado(s)' : 'employé(s) sélectionné(s)'}
                    {isPt ? ' · ' : '— '}{isPt ? 'Custo/dia' : 'Coût/j'}: {fmt(membresList.filter(m => (form.membres_ids || []).includes(m.id)).reduce((s, m) => s + m.daily_cost, 0), dl)} €
                  </div>
                )}
              </div>

              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <label className={isV5 ? "v5-fl" : "v22-form-label"}>{isPt ? 'Descrição' : 'Description'}</label>
                <textarea className={isV5 ? "v5-fi" : "v22-input"} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} style={{ resize: 'none' }} />
              </div>
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid #E8E8E8', display: 'flex', gap: 8 }}>
              <button className={isV5 ? "v5-btn" : "v22-btn"} style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                {isPt ? 'Cancelar' : 'Annuler'}
              </button>
              <button
                className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleSave}
                disabled={!form.titre.trim() || saving}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {' '}{editId ? (isPt ? 'Guardar' : 'Enregistrer') : (isPt ? 'Criar obra' : 'Créer le chantier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL LIAISON DEVIS ══════ */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? "v5-card" : "v22-card"} style={{ width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} /> {isPt ? 'Associar um orçamento a esta obra' : 'Lier un devis à ce chantier'}
              </span>
              <button className={isV5 ? "v5-btn v5-btn-sm" : "v22-btn v22-btn-sm"} onClick={() => setShowLinkModal(null)}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {availableDevis.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '20px 0' }}>
                  {isPt ? 'Nenhum orçamento disponível (sem obra associada)' : 'Aucun devis disponible (non liés à un chantier)'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {availableDevis.map(d => (
                    <button
                      key={d.id}
                      className={isV5 ? "v5-btn" : "v22-btn"}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start' }}
                      onClick={() => linkDevis(d.id, showLinkModal)}
                    >
                      <span style={{ fontSize: 16 }}>📋</span>
                      <span style={{ fontWeight: 600, flex: '0 0 auto' }}>{d.numero}</span>
                      <span style={{ color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client_name}</span>
                      {d.total_ht != null && (
                        <span style={{ color: '#333', fontWeight: 600, flex: '0 0 auto' }}>{d.total_ht.toLocaleString(dl)} €</span>
                      )}
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 600, flex: '0 0 auto',
                        background: '#E3F2FD', color: '#1565C0',
                      }}>
                        {isPt ? statutDocumentPt(d.status, 'devis') : d.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
