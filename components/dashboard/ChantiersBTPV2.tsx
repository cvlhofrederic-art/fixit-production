'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData, useBTPSettings } from '@/lib/hooks/use-btp-data'
import { adresseComplete, geocoderAdresse, type AdresseChantier } from '@/lib/btp/geocodage'
import {
  aideAlerteMeteo, avertissementPositionGardee, champsModifies, noteAlerteSansPosition, porteLaPositionEnregistree,
  questionGarderPosition, questionPositionNecessaire, questionRetirerPosition,
} from '@/lib/btp/fiche-chantier'
import { positionPourAlerte } from '@/lib/btp/alerte-meteo'
import { confirmationRelocaliser } from '@/components/dashboard/btp/pointage/textes'
import { COLONNES_LIEU_DEVIS, champsAdresseDuLieu, libelleChoixDevis, lieuDuDevis, messageAdresseImportee } from '@/lib/btp/lieu-devis'
import { supabase } from '@/lib/supabase'
import type { Artisan } from '@/lib/types'
import { estSousCompteSociete } from '@/lib/documents/identite-documents'
import { lierDevisAuChantierSociete, lireDocumentsDesChantiers } from '@/lib/documents/societe-client'
import { messageRefusDocuments } from '@/lib/documents/messages-refus'
import {
  equipeDuJour, figerJoursPasses, joursEntre, lireEquipeParJour, periodeTronquee, simplifierEquipeParJour, type EquipeParJour,
} from '@/lib/btp/equipe-par-jour'
import { jourLocal } from '@/lib/btp/accueil'
import {
  TAUX_MATERIAUX_ESTIME_PCT, compositionDuJour, dateFinProlongee, debutPointagesFiables, depensesDeLObra, lirePointages,
  nomsDesPointes, pointagesParJour, rentabiliteObra, totalAutresDepensesHT, totalMateriauxHT, type DepenseObra,
} from '@/lib/btp/rentabilite-obra'
import { jourOuvreDans, nomFerie, paysDuCodePostal, type PaysObra } from '@/lib/btp/jours-feries'
import { PLAFONDS_LECTURE_BTP } from '@/lib/btp/plafonds-lecture'
import { EquipeParJourEditeur } from '@/components/dashboard/btp/EquipeParJourEditeur'
import { DepensesObraEditeur } from '@/components/dashboard/btp/DepensesObraEditeur'
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
  /** Chantier exposé aux intempéries : alerte météo de la veille aux salariés affectés (26/11/2026). */
  alerteMeteo: boolean
  /** Jours où l'équipe diffère de l'équipe habituelle (28/11/2026, lib/btp/equipe-par-jour.ts). */
  equipe_par_jour?: EquipeParJour
}

const EMPTY_FORM: ChantierForm = {
  titre: '', client: '', adresse: '', ville: '', codePostal: '',
  dateDebut: '', dateFin: '',
  budget: '', statut: 'En attente', description: '', equipe: '',
  latitude: null, longitude: null, geoRayonM: 100,
  devis_id: null, membres_ids: [], alerteMeteo: false, equipe_par_jour: {},
}

/** « AAAA-MM-JJ » du jour, dans le fuseau du navigateur (celui du gérant). */
const aujourdhuiLocal = () => jourLocal(new Date())

/**
 * Période proposée dans « Équipe par jour » : de la date de début à la date de fin ; pour une obra en cours dont la fin
 * est dépassée, jusqu'à aujourd'hui (les jours de retard ont aussi une équipe).
 */
function periodeDeLaFiche(f: Pick<ChantierForm, 'dateDebut' | 'dateFin' | 'statut'>): { debut: string; fin: string } {
  const aujourdhui = aujourdhuiLocal()
  const fin = f.statut === 'En cours' && f.dateFin && aujourdhui > f.dateFin ? aujourdhui : f.dateFin
  return { debut: f.dateDebut, fin }
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
  /** Coût horaire chargé (moteur de paie), pour les heures pointées. */
  cout_heure: number
  /** Indemnités d'une journée (panier, trajet), hors coût horaire : ajoutées une fois par jour pointé. */
  indemnite_jour: number
}

type DocLie = { id: string; type: 'devis' | 'facture'; numero: string; client_name: string; total_ht: number | null; status: string }
type LigneDocument = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Devis et factures rattachés, rangés par chantier (lignes de la table, lues par le navigateur ou par le serveur). */
function grouperDocumentsLies(devis: readonly LigneDocument[], factures: readonly LigneDocument[]): Record<string, DocLie[]> {
  const grouped: Record<string, DocLie[]> = {}
  const ranger = (d: LigneDocument, type: DocLie['type']) => {
    const cid = d.chantier_id as string
    if (!cid) return
    if (!grouped[cid]) grouped[cid] = []
    grouped[cid].push({ id: d.id, type, numero: d.numero || '', client_name: d.client_name || '', total_ht: d.total_ht_cents != null ? d.total_ht_cents / 100 : null, status: d.status || '' })
  }
  for (const d of devis) ranger(d, 'devis')
  for (const f of factures) ranger(f, 'facture')
  return grouped
}

/** Devis proposés par « Lier un devis » (au plus 50, dans l'ordre reçu : les plus récents d'abord). */
function devisALier(lignes: readonly LigneDocument[]) {
  return lignes.slice(0, 50).map(d => ({
    id: d.id as string,
    numero: d.numero || '',
    client_name: d.client_name || '',
    total_ht: d.total_ht_cents != null ? d.total_ht_cents / 100 : null,
    status: d.status || '',
  }))
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

const STATUTS_CHANTIER = ['En attente', 'En cours', 'Terminé', 'Annulé'] as const
const STATUTS_PT: Record<string, string> = { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }

/**
 * Pastille de la liste : chantier soumis à l'alerte météo (26/11/2026). Grisée quand la position GPS manque : aucune
 * alerte ne part alors, ni notification ni e-mail.
 */
function PastilleAlerteMeteo({ latitude, longitude, isV5, isPt }: { latitude: unknown; longitude: unknown; isV5: boolean; isPt: boolean }) {
  const nom = isPt ? 'Meteorologia' : 'Météo'
  if (!positionPourAlerte(latitude, longitude)) {
    return (
      <span className={isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray'} style={{ fontSize: 9 }}
        title={isPt ? 'Alerta meteorológico sem posição GPS: nenhum alerta é enviado' : 'Alerte météo sans position GPS : aucune alerte ne part'}>
        🔔 {nom} — {isPt ? 'sem GPS' : 'sans GPS'}
      </span>
    )
  }
  return (
    <span className={isV5 ? 'v5-badge v5-badge-orange' : 'v22-tag v22-tag-orange'} style={{ fontSize: 9 }}
      title={isPt ? 'Alerta meteorológico por notificação' : 'Alerte météo par notification'}>
      🔔 {nom}
    </span>
  )
}
/** Libellé d'un statut de chantier (valeur enregistrée en français, affichée en portugais sur /pt). */
function libelleStatut(statut: string, isPt: boolean): string {
  return isPt ? STATUTS_PT[statut] ?? statut : statut
}

/** Sous-titre de l'écran : « gestion » pour qui gère les chantiers, simple liste pour qui les consulte. */
function sousTitreChantiers(actifs: number, isPt: boolean, lectureSeule: boolean): string {
  if (lectureSeule) return isPt ? `As suas obras: ${actifs} ativa(s)` : `Vos chantiers — ${actifs} actif(s)`
  return isPt ? `Gestão das suas obras: ${actifs} ativa(s)` : `Gestion de vos chantiers — ${actifs} actif(s)`
}

/**
 * `lectureSeule` : salarié sans droit d'écriture sur les chantiers (ouvrier, chef de chantier, conducteur de travaux
 * par défaut, 25/11/2026). Il consulte les chantiers qui lui sont affectés — /api/btp ne lui rend que ceux-là, sans
 * client ni montant — sans aucun bouton de création, de modification, de statut, de suppression ni de liaison de
 * devis : le serveur les lui refuserait tous (403).
 */
export function ChantiersBTPV2({ artisan, orgRole, lectureSeule = false, gestionMateriaux = !lectureSeule }: {
  artisan: Artisan; orgRole?: string; lectureSeule?: boolean
  /**
   * Saisie des achats de matériaux dans la fiche (28/11/2026). Ils s'enregistrent comme dépenses de l'obra, qui relèvent
   * du module Comptabilité BTP (lib/btp/perimetre-compte.ts) : le tableau de bord passe le droit d'écriture sur ce module.
   */
  gestionMateriaux?: boolean
}) {
  const isV5 = orgRole === 'pro_societe'
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dl = isPt ? 'pt-PT' : 'fr-FR'
  // Compte invité dans la société : ses devis sont ceux de l'entreprise, que la RLS ne lui rend pas. Lus et liés par le
  // serveur (app/api/pro/documents/chantiers), qui vérifie son rôle ; le titulaire garde ses lectures directes.
  const sousCompte = estSousCompteSociete(artisan)
  // Une seule lecture du serveur pour les deux chargements du montage (devis à importer, documents liés). L'ouverture
  // d'une fiche, « Lier un devis » et la relecture après une liaison la refont. Une lecture en échec n'est pas gardée :
  // la suivante réessaie (elle servait sinon à chaque ouverture de « Nouveau chantier », tant que l'écran restait ouvert).
  const lectureSocieteRef = useRef<ReturnType<typeof lireDocumentsDesChantiers> | null>(null)
  const documentsDeLaSociete = useCallback(async (relire = false) => {
    if (relire || !lectureSocieteRef.current) lectureSocieteRef.current = lireDocumentsDesChantiers()
    const lecture = lectureSocieteRef.current
    const lu = await lecture
    if (!lu.ok && lectureSocieteRef.current === lecture) lectureSocieteRef.current = null
    return lu
  }, [])
  /**
   * Une lecture des documents de la société en échec se dit : la liste restait vide, « aucun document lié », « aucun
   * devis trouvé ». Un rôle sans droit sur les devis (salarié de terrain) n'a rien à y voir : pas de message.
   */
  const signalerLectureEnEchec = useCallback((lu: { message: string; code?: string }) => {
    if (lu.code !== 'aucun_droit') toast.error(messageRefusDocuments(lu, isPt), { id: 'chantiers-documents-societe' })
  }, [isPt])

  const { items: chantiers, loading, add, update, remove } = useBTPData({
    table: 'chantiers',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
  })
  const { settings } = useBTPSettings()
  // Achats de matériaux des obras (dépenses de catégorie « materiaux », montants hors IVA). Pas de reprise des anciennes
  // dépenses du navigateur depuis cet écran : l'accueil s'en charge déjà.
  const { items: depenses, add: ajouterDepense, remove: retirerDepense } = useBTPData<DepenseObra>({
    table: 'depenses',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
    autoImport: false,
  })
  // Pointages de la société (les plus récents) : un jour passé pointé sur une obra compte ses heures réelles.
  const { items: pointages } = useBTPData<Record<string, unknown>>({
    table: 'pointages',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
    autoImport: false,
  })

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
  /** Tous les employés, anciens compris : un ancien employé a coûté les jours où il était sur l'obra. */
  const [membresTous, setMembresTous] = useState<MembreSummary[]>([])
  const [loadingDevis, setLoadingDevis] = useState(false)
  /** Liste des devis ouverte sous « Adresse du chantier » (bouton « Importer depuis un devis »). */
  const [choixAdresseOuvert, setChoixAdresseOuvert] = useState(false)
  /** Adresse posée par le dernier import d'un devis : retouchée depuis à la main, elle n'est plus celle du devis. */
  const adresseImporteeRef = useRef<{ adresse: string; codePostal: string; ville: string } | null>(null)

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
  const loadDevisAndMembres = useCallback(async (relire = false) => {
    setLoadingDevis(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (sess?.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`
      const devisRequete = (colonnes: string) => supabase.from('devis').select(colonnes).eq('artisan_id', artisan?.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50)
      const lireDevis = async (): Promise<DevisSummary[] | null> => {
        if (sousCompte) {
          // Un rôle sans droit sur les devis (salarié de terrain) reçoit un refus : aucun devis à proposer.
          const lu = await documentsDeLaSociete(relire)
          if (!lu.ok) { signalerLectureEnEchec(lu); return null }
          return lu.valeur.devis.slice(0, 50) as unknown as DevisSummary[]
        }
        const lectureAvecLieu = await devisRequete(`${COLONNES_DEVIS_IMPORT}, ${COLONNES_LIEU_DEVIS}`)
        const devisRes = lectureAvecLieu.error ? await devisRequete(`${COLONNES_DEVIS_IMPORT}, client_address`) : lectureAvecLieu
        return devisRes.data ? (devisRes.data as unknown as DevisSummary[]) : null
      }
      const [devisLus, membresRes] = await Promise.all([
        lireDevis(),
        fetch('/api/btp?table=membres', { headers }),
      ])
      if (devisLus) setDevisList(devisLus)
      if (membresRes.ok) {
        const j = await membresRes.json()
        // Tous les employés (le coût d'un ancien employé compte encore les jours où il était là) ; seuls les actifs se choisissent.
        const membres = j.membres || []
        // Calculer le coût journalier via payroll engine
        const { calculateEmployeeCost } = await import('@/lib/payroll/engine')
        const country = (settings.country || 'FR') as 'FR' | 'PT'
        const companyType = settings.company_type || settings.statut_juridique || (country === 'FR' ? 'sarl' : 'lda')
        const mapped: MembreSummary[] = membres.map((m: { actif?: boolean; prenom?: string; nom?: string; role?: string; poste?: string; salaire_net_mensuel?: number; salaire_net?: number; heures_hebdo?: number; panier_repas_jour?: number; indemnite_trajet_jour?: number; prime_mensuelle?: number; charges_salariales_pct?: number; charges_patronales_pct?: number; cout_horaire?: number; id: string }) => {
          const netSalary = m.salaire_net_mensuel || m.salaire_net || 0
          let dailyCost = 0
          let coutHeure = 0
          let indemniteJour = 0
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
            coutHeure = b.cost_per_hour
            indemniteJour = b.indemnites_jour
          } else {
            const ch = m.cout_horaire || settings.cout_horaire_ouvrier || 15
            const cp = (m.charges_patronales_pct || settings.charges_patronales_pct || 45) / 100
            dailyCost = ch * (1 + cp) * 7
            coutHeure = ch * (1 + cp)
          }
          return {
            id: m.id, prenom: m.prenom || '', nom: m.nom || '',
            role: m.role || m.poste || 'Ouvrier',
            daily_cost: Math.round(dailyCost * 100) / 100,
            cout_heure: Math.round(coutHeure * 100) / 100,
            indemnite_jour: Math.round(indemniteJour * 100) / 100,
            actif: m.actif !== false,
          }
        })
        setMembresTous(mapped)
        setMembresList(mapped.filter(m => m.actif))
      }
    } catch (e) { console.error('loadDevisAndMembres:', e) }
    setLoadingDevis(false)
  }, [artisan?.id, settings, sousCompte, documentsDeLaSociete, signalerLectureEnEchec])

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
    // tapée ou retouchée à la main, mais retire celle d'un devis importé avant, inchangée (et sa position) : elle n'est
    // pas celle de ce devis.
    const lieu = lieuDuDevis(devis)
    const champs = lieu ? champsAdresseDuLieu(lieu.texte, isPt ? 'PT' : 'FR') : null
    const importee = adresseImporteeRef.current
    const adresseDuDevisPrecedent = !!form.devis_id && !!importee
      && form.adresse === importee.adresse && form.codePostal === importee.codePostal && form.ville === importee.ville
    let adresse: Partial<ChantierForm> = {}
    if (champs) adresse = { ...champs, ...SANS_POSITION }
    else if (adresseDuDevisPrecedent) adresse = { adresse: '', codePostal: '', ville: '', ...SANS_POSITION }
    if (Object.keys(adresse).length > 0) oublierGeocodage()
    adresseImporteeRef.current = champs
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
    adresseImporteeRef.current = champs
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

  /** Employés de l'équipe habituelle qui ne sont plus actifs (désactivés ou supprimés) : affichés pour être retirés. */
  const partisCoches = (f: ChantierForm): string[] => (f.membres_ids || []).filter(id => !membresList.some(m => m.id === id))

  /**
   * Coche ou décoche un employé de l'équipe habituelle. Sur une obra existante, les jours passés sans liste à eux
   * gardent l'équipe d'avant (figerJoursPasses) : changer l'équipe ne réécrit pas qui était là ces jours-là. La route
   * fait de même pour l'onglet Affectations du pointage.
   */
  const basculerHabituel = (id: string) => {
    const ids = form.membres_ids || []
    const nouveaux = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    const equipeParJour = editId
      ? figerJoursPasses({
        debut: form.dateDebut, aujourdhui: aujourdhuiLocal(), ancienneEquipe: ids, nouvelleEquipe: nouveaux,
        equipeParJour: form.equipe_par_jour ?? {}, ouvre: jourOuvreDans(paysObra(form.codePostal)),
      })
      : form.equipe_par_jour ?? {}
    setForm({ ...form, membres_ids: nouveaux, equipe_par_jour: equipeParJour })
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
    // Seuls les jours qui diffèrent de l'équipe habituelle s'enregistrent (une retouche redevenue identique disparaît).
    fiche = { ...fiche, equipe_par_jour: simplifierEquipeParJour(fiche.equipe_par_jour ?? {}, fiche.membres_ids ?? [], aujourdhuiLocal(), jourOuvreDans(paysObra(fiche.codePostal))) }
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
      alerteMeteo: c.alerteMeteo === true,
      // Sous la forme où l'enregistrement la renvoie : rouvrir puis enregistrer sans rien toucher n'envoie rien.
      equipe_par_jour: simplifierEquipeParJour(lireEquipeParJour(c.equipe_par_jour), c.membres_ids || [], aujourdhuiLocal(), jourOuvreDans(paysObra(c.codePostal))),
    }
    ficheOuverteRef.current = fiche
    setForm(fiche)
    setChoixAdresseOuvert(false)
    setShowModal(true)
    void loadDevisAndMembres(true)
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
    // Fenêtre gardée si la prolongation n'est pas enregistrée (le hook en affiche la raison).
    if (await update(c.id, { dateFin: dateFinProlongee(c.dateFin, prolongDays, aujourdhuiLocal()) } as any)) setProlongModal(null)
  }

  // ── Rentabilité par chantier (hors IVA, équipe jour par jour, matériaux saisis : lib/btp/rentabilite-obra.ts) ──
  const coutJourParMembre = useMemo(() => new Map(membresTous.map(m => [m.id.toLowerCase(), m.daily_cost])), [membresTous])
  // Employés actifs, une fois les fiches chargées : un employé parti ne coûte plus rien à partir d'aujourd'hui.
  const actifs = useMemo(
    () => (membresTous.length > 0 ? new Set(membresList.map(m => m.id.toLowerCase())) : undefined),
    [membresTous, membresList],
  )
  const coutHeureParMembre = useMemo(
    () => new Map(membresTous.filter(m => m.cout_heure > 0).map(m => [m.id.toLowerCase(), m.cout_heure])),
    [membresTous],
  )
  const indemniteJourParMembre = useMemo(
    () => new Map(membresTous.filter(m => m.indemnite_jour > 0).map(m => [m.id.toLowerCase(), m.indemnite_jour])),
    [membresTous],
  )
  /**
   * Pays de l'obra : son code postal le dit (4050-262, 13008), sinon la langue de l'écran — le même signal que la route
   * qui fige le passé pour l'onglet Affectations (cookie « locale »), pour que les deux appliquent les mêmes fériés.
   */
  const paysSociete: PaysObra = isPt ? 'PT' : 'FR'
  const paysObra = useCallback((codePostal: unknown): PaysObra => paysDuCodePostal(codePostal) ?? paysSociete, [paysSociete])
  // Pointages de la société : une liste coupée par le plafond de lecture n'est fiable qu'après son jour le plus ancien.
  const pointagesLus = useMemo(() => lirePointages(pointages), [pointages])
  const pointagesDepuis = useMemo(
    () => debutPointagesFiables(pointagesLus, pointages.length >= PLAFONDS_LECTURE_BTP.pointages),
    [pointagesLus, pointages.length],
  )
  const pointesSociete = useMemo(
    () => pointagesParJour(pointagesLus, aujourdhuiLocal(), pointagesDepuis),
    [pointagesLus, pointagesDepuis],
  )
  const pointesDeLObra = useCallback(
    (chantierId: string) => pointagesParJour(pointagesLus.filter(p => p.chantierId === chantierId), aujourdhuiLocal(), pointagesDepuis),
    [pointagesLus, pointagesDepuis],
  )
  /** Coût d'une journée d'ouvrier par défaut (réglages), celui de l'ancien calcul. */
  const coutJourParDefaut = (settings.cout_horaire_ouvrier || 15) * (1 + (settings.charges_patronales_pct || 45) / 100) * 7
  const getRenta = useCallback((c: ChantierForm & { id: string; statut?: string }, dateFin?: string) => rentabiliteObra({
    valeurHT: Number(c.budget) || 0,
    dateDebut: c.dateDebut,
    dateFin: dateFin ?? c.dateFin,
    statut: c.statut || '',
    membresIds: c.membres_ids || [],
    equipeParJour: lireEquipeParJour(c.equipe_par_jour),
    coutJourParMembre,
    coutJourParDefaut,
    nbEmployesSansEquipe: Number(c.equipe) || 1,
    materiauxHT: totalMateriauxHT(depenses, c.id),
    autresDepensesHT: totalAutresDepensesHT(depenses, c.id),
    pointesIci: pointesDeLObra(c.id),
    pointesSociete,
    coutHeureParMembre,
    indemniteJourParMembre,
    ouvre: jourOuvreDans(paysObra(c.codePostal)),
    actifs,
    aujourdhui: aujourdhuiLocal(),
  }), [coutJourParMembre, coutHeureParMembre, indemniteJourParMembre, coutJourParDefaut, depenses, pointesDeLObra, pointesSociete, paysObra, actifs])

  // ── Charger membres au mount ──
  useEffect(() => { loadDevisAndMembres() }, [loadDevisAndMembres])

  // ── Fetch linked docs (devis + factures with chantier_id set) ──
  const loadLinkedDocs = useCallback(async (relire = false) => {
    if (!artisan?.id) return
    try {
      if (sousCompte) {
        const lu = await documentsDeLaSociete(relire)
        if (lu.ok) setLinkedDocs(grouperDocumentsLies(lu.valeur.devis, lu.valeur.factures))
        else signalerLectureEnEchec(lu)
        return
      }
      const [devisRes, facturesRes] = await Promise.all([
        supabase.from('devis').select('id, numero, client_name, total_ht_cents, status, chantier_id').eq('artisan_id', artisan.id).not('chantier_id', 'is', null).is('deleted_at', null),
        supabase.from('factures').select('id, numero, client_name, total_ht_cents, status, chantier_id').eq('artisan_id', artisan.id).not('chantier_id', 'is', null).is('deleted_at', null),
      ])
      setLinkedDocs(grouperDocumentsLies(devisRes.data || [], facturesRes.data || []))
    } catch (e) { console.error('loadLinkedDocs:', e) }
  }, [artisan?.id, sousCompte, documentsDeLaSociete, signalerLectureEnEchec])

  useEffect(() => { void loadLinkedDocs() }, [loadLinkedDocs])

  // ── Open link modal: fetch unlinked devis ──
  const openLinkModal = useCallback(async (chantierId: string) => {
    setShowLinkModal(chantierId)
    try {
      if (sousCompte) {
        const lu = await documentsDeLaSociete(true)
        if (!lu.ok) { toast.error(messageRefusDocuments(lu, isPt)); setAvailableDevis([]); return }
        setAvailableDevis(devisALier(lu.valeur.devis.filter(d => !d.chantier_id)))
        return
      }
      const { data } = await supabase
        .from('devis')
        .select('id, numero, client_name, total_ht_cents, status')
        .eq('artisan_id', artisan?.id)
        .is('chantier_id', null)
        // Un devis supprimé n'est plus proposé (la liste des documents liés les écarte déjà).
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      setAvailableDevis(devisALier(data || []))
    } catch (e) { console.error('openLinkModal:', e) }
  }, [artisan?.id, sousCompte, isPt, documentsDeLaSociete])

  // ── Link a devis to a chantier ──
  const linkDevis = useCallback(async (devisId: string, chantierId: string) => {
    const echec = isPt ? 'Erro ao associar o orçamento' : 'Erreur lors de la liaison'
    if (sousCompte) {
      const envoye = await lierDevisAuChantierSociete(devisId, chantierId)
      if (!envoye.ok) { toast.error(envoye.code ? messageRefusDocuments(envoye, isPt) : echec); return }
    } else {
      // `.select` : une mise à jour que la RLS filtre ne renvoie pas d'erreur, seulement aucune ligne.
      const { data, error } = await supabase.from('devis').update({ chantier_id: chantierId } as any).eq('id', devisId).select('id')
      if (error || !data || data.length === 0) { toast.error(echec); return }
    }
    toast.success(isPt ? 'Orçamento associado à obra' : 'Devis lié au chantier')
    setShowLinkModal(null)
    await loadLinkedDocs(true)
  }, [loadLinkedDocs, isPt, sousCompte])

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
        <p>{sousTitreChantiers(activeCount, isPt, lectureSeule)}</p>
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
        {!lectureSeule && (
          <button
            className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
            onClick={() => { oublierGeocodage(); setEditId(null); setForm(EMPTY_FORM); setChoixAdresseOuvert(false); setShowModal(true); void loadDevisAndMembres(true) }}
          >
            + {isPt ? 'Nova obra' : 'Nouveau chantier'}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className={isV5 ? "v5-card" : "v22-card"} style={{ padding: '1.25rem', textAlign: 'center' }}>
          <HardHat size={40} style={{ margin: '0 auto 10px', color: '#BBB' }} />
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            {isPt ? 'Nenhuma obra' : 'Aucun chantier'}
          </div>
          {lectureSeule ? (
            <p style={{ fontSize: 12, color: '#999' }}>
              {isPt
                ? 'Não lhe está atribuída nenhuma obra em curso. Se achar que é um erro, avise o seu responsável.'
                : 'Aucun chantier en cours ne vous est affecté. Si vous pensez que c’est une erreur, prévenez votre responsable.'}
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
                {isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}
              </p>
              <button
                className={isV5 ? "v5-btn v5-btn-p" : "v22-btn v22-btn-primary"}
                onClick={() => { oublierGeocodage(); setEditId(null); setForm(EMPTY_FORM); setChoixAdresseOuvert(false); setShowModal(true); void loadDevisAndMembres(true) }}
              >
                + {isPt ? 'Criar obra' : 'Créer un chantier'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={isV5 ? "v5-card" : "v22-card"} style={{ overflowX: 'auto' }}>
          <table className={isV5 ? "v5-dt" : "v22-table"}>
            <thead>
              <tr>
                <th>{isPt ? 'Ref.' : 'Réf'}</th>
                <th>{isPt ? 'Obra' : 'Chantier'}</th>
                {!lectureSeule && <th>{isPt ? 'Cliente' : 'Client'}</th>}
                {/* Chef : lu dans les fiches employés, que le salarié ne reçoit pas (il n'y verrait que « — »). */}
                {!lectureSeule && <th>{isPt ? 'Encarregado' : 'Chef'}</th>}
                <th>{isPt ? 'Início' : 'Début'}</th>
                <th>{isPt ? 'Fim' : 'Fin'}</th>
                <th>{isPt ? 'Avanço' : 'Avanc.'}</th>
                <th>{isPt ? 'Estado' : 'Statut'}</th>
                {!lectureSeule && <th>{isPt ? 'Valor' : 'Budget'}</th>}
                {!lectureSeule && <th></th>}
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
                        {c.alerteMeteo && <PastilleAlerteMeteo latitude={c.latitude} longitude={c.longitude} isV5={isV5} isPt={isPt} />}
                      </div>
                      {c.adresse && (
                        <div style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={9} /> {c.adresse}
                        </div>
                      )}
                    </td>
                    {!lectureSeule && <td>{c.client || '—'}</td>}
                    {!lectureSeule && <td>
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
                    </td>}
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
                      {lectureSeule ? (
                        <span style={{ fontSize: 10, fontWeight: 600 }}>{libelleStatut(c.statut || 'En attente', isPt)}</span>
                      ) : (
                        <select
                          className={isV5 ? "v5-filter-sel" : "v22-filter-sel"}
                          style={{ fontSize: 10, padding: '2px 6px', fontWeight: 600, minWidth: 90 }}
                          value={c.statut || 'En attente'}
                          onChange={e => changeStatut(c.id, e.target.value)}
                        >
                          {STATUTS_CHANTIER.map(s => <option key={s} value={s}>{libelleStatut(s, isPt)}</option>)}
                        </select>
                      )}
                    </td>
                    {!lectureSeule && (
                      <td style={{ fontWeight: 600 }}>
                        {c.budget ? `${Number(c.budget).toLocaleString(dl)} €` : '—'}
                      </td>
                    )}
                    {!lectureSeule && (
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
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* ── Devis et factures liés (pas en lecture seule : ni devis lisibles, ni liaison permise) ── */}
          {!lectureSeule && <div style={{ marginTop: 12 }}>
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
          </div>}

          {/* ── Rentabilité details below table (montants : jamais en lecture seule) ── */}
          {!lectureSeule && filtered.some((c: ChantierForm & { id: string; statut?: string }) => getRenta(c) !== null) && (
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
                        {' '}{c.titre}: {renta.beneficeActuel >= 0 ? '+' : ''}{fmt(renta.beneficeActuel, dl)} € {isPt ? 's/ IVA' : 'HT'}
                      </span>
                      <span style={{ color: '#666' }}>
                        ({isPt ? 'Margem' : 'Marge'}: {renta.margePrevuePct.toLocaleString(dl)}{isPt ? '%' : ' %'})
                      </span>
                      {/* Détail du calcul, tout hors IVA : valeur − matériaux − autres dépenses − main-d'œuvre. */}
                      <span style={{ color: '#666' }}>
                        {isPt ? 'Valor' : 'Budget'} {fmt(renta.valeurHT, dl)} €
                        {' · '}{isPt ? 'Materiais' : 'Matériaux'} {fmt(renta.materiauxHT, dl)} €
                        {renta.materiauxEstimes && (isPt ? ` (estimativa ${TAUX_MATERIAUX_ESTIME_PCT}%)` : ` (estimation ${TAUX_MATERIAUX_ESTIME_PCT} %)`)}
                        {renta.autresDepensesHT > 0 && <>{' · '}{isPt ? 'Outras despesas' : 'Autres dépenses'} {fmt(renta.autresDepensesHT, dl)} €</>}
                        {' · '}{isPt ? 'Mão de obra' : 'Main-d’œuvre'} {fmt(renta.coutMOPrevu, dl)} € ({renta.joursTravailles} {isPt ? 'dias de trabalho' : 'jours travaillés'}
                        {renta.joursPointes > 0 && (isPt ? `, dos quais ${renta.joursPointes} com registo de ponto` : `, dont ${renta.joursPointes} pointé${renta.joursPointes > 1 ? 's' : ''}`)}
                        {renta.equipeEstimee && (isPt ? ', equipa estimada' : ', équipe estimée')}
                        {renta.coutsParDefaut && (isPt ? ', custo por defeito' : ', coût par défaut')})
                      </span>
                    </div>

                    {renta.enRetard && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#C62828' }}>
                          <Siren size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {renta.joursRetard}{isPt ? ' dias de atraso' : 'j retard'} = -{fmt(renta.coutRetard, dl)} €
                        </span>
                        <span style={{ color: '#E53935' }}>
                          (-{fmt(renta.coutJourEquipe, dl)} €/{isPt ? 'dia' : 'jour'})
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
        // Même calcul avec la date de fin repoussée : l'équipe des jours ajoutés est celle de chaque jour (habituelle en
        // semaine, retouches comprises), et la main-d'œuvre compte les jours de retard déjà écoulés.
        const newRenta = renta ? getRenta(c, dateFinProlongee(c.dateFin, prolongDays, aujourdhuiLocal())) : null
        const coutMO = (r: NonNullable<typeof renta>) => r.coutMOPrevu + r.coutRetard
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
                  <strong>{c.titre}</strong>{isPt ? ' · ' : ' — '}{isPt ? 'Previsto' : 'Prévu'}: {renta?.joursCalendrier}{isPt ? ' dias' : ' jours'}
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
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#C62828' }}>{fmt(coutMO(newRenta), dl)} €</div>
                        <div style={{ fontSize: 10, color: '#C62828' }}>+{fmt(coutMO(newRenta) - coutMO(renta), dl)} €</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#999' }}>{isPt ? 'Nova rentabilidade' : 'Nouvelle rentabilité'}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: newRenta.beneficeActuel >= 0 ? '#2E7D32' : '#C62828' }}>
                          {newRenta.beneficeActuel >= 0 ? '+' : ''}{fmt(newRenta.beneficeActuel, dl)} € {isPt ? 's/ IVA' : 'HT'}
                        </div>
                        <div style={{ fontSize: 10, color: newRenta.beneficeActuel < renta.beneficeActuel ? '#C62828' : '#999' }}>
                          {fmt(newRenta.beneficeActuel - renta.beneficeActuel, dl)} €
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
                {membresList.length === 0 && partisCoches(form).length === 0 ? (
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
                          <input type="checkbox" checked={selected} onChange={() => basculerHabituel(m.id)} />
                          <span style={{ fontWeight: 600 }}>{m.prenom} {m.nom}</span>
                          <span style={{ color: '#999' }}>{isPt ? ROLE_PT[m.role] ?? m.role : m.role}</span>
                          <span style={{ color: '#C62828', marginLeft: 'auto' }}>{m.daily_cost.toFixed(0)} €/{isPt ? 'dia' : 'j'}</span>
                        </label>
                      )
                    })}
                    {/* Employé désactivé ou supprimé resté dans l'équipe : visible pour pouvoir le retirer (il ne compte plus
                        à partir d'aujourd'hui ; ses jours passés restent). */}
                    {partisCoches(form).map(id => {
                      const ancien = membresTous.find(m => m.id === id)
                      return (
                        <label key={id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
                          background: '#FAFAFA', border: '1px dashed #BDBDBD', fontSize: 12, color: '#777',
                        }}>
                          <input type="checkbox" checked onChange={() => basculerHabituel(id)} />
                          <span style={{ fontWeight: 600 }}>{ancien ? `${ancien.prenom} ${ancien.nom}` : (isPt ? 'Colaborador removido' : 'Employé supprimé')}</span>
                          <span>{ancien ? (isPt ? 'inativo' : 'inactif') : ''}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11 }}>{isPt ? 'desmarque para o retirar' : 'décochez pour le retirer'}</span>
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

              {/* ── Équipe jour par jour (28/11/2026) : l'équipe habituelle ci-dessus, retouchée un jour donné ── */}
              {(() => {
                const { debut, fin } = periodeDeLaFiche(form)
                const pays = paysObra(form.codePostal)
                const ouvre = jourOuvreDans(pays)
                // Jours passés pointés sur l'obra ouverte : pointés à leurs heures, prévus sans pointage (même règle que le calcul).
                const compositions = new Map([...(editId ? pointesDeLObra(editId) : new Map<string, Map<string, number | null>>())]
                  .map(([jour, ici]) => [jour, compositionDuJour(
                    equipeDuJour(jour, form.membres_ids || [], form.equipe_par_jour ?? {}, ouvre), ici, pointesSociete.get(jour),
                  )]))
                return (
                  <EquipeParJourEditeur
                    jours={joursEntre(debut, fin)} tronque={periodeTronquee(debut, fin)} aujourdhui={jourLocal(new Date())}
                    ouvre={ouvre} ferie={jour => nomFerie(jour, pays, isPt)} compositions={compositions} noms={nomsDesPointes(pointagesLus)}
                    membres={membresList} membresTous={membresTous}
                    membresIds={form.membres_ids || []} equipeParJour={form.equipe_par_jour ?? {}}
                    onChange={equipeParJour => setForm(f => ({ ...f, equipe_par_jour: equipeParJour }))}
                    isPt={isPt} isV5={isV5} dl={dl}
                  />
                )
              })()}

              {/* ── Dépenses de l'obra, hors IVA (28/11/2026) : enregistrées tout de suite comme dépenses de l'obra ── */}
              {gestionMateriaux && (editId ? (
                <DepensesObraEditeur
                  depenses={depensesDeLObra(depenses, editId)}
                  onAjouter={async depense => (await ajouterDepense({ ...depense, chantierId: editId })) !== null}
                  onRetirer={retirerDepense}
                  isPt={isPt} isV5={isV5} dl={dl}
                />
              ) : (
                <div className={isV5 ? "v5-fg" : "v22-form-group"} style={{ fontSize: 11, color: '#999' }}>
                  {isPt
                    ? 'Despesas da obra: crie a obra e depois abra-a para registar materiais e outras despesas (valores s/ IVA).'
                    : 'Dépenses du chantier : créez le chantier, puis rouvrez-le pour saisir matériaux et autres dépenses (montants HT).'}
                </div>
              ))}

              {/* Alerte météo par notification (26/11/2026) : seulement pour un chantier exposé aux intempéries. Placée sous les
                  employés affectés, ceux qu'elle prévient. */}
              <div className={isV5 ? "v5-fg" : "v22-form-group"}>
                <label htmlFor="chantier-alerte-meteo" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                  {/* Nom accessible : le titre seul ; l'aide et la note GPS en description. */}
                  <input id="chantier-alerte-meteo" type="checkbox" checked={form.alerteMeteo}
                    aria-labelledby="chantier-alerte-meteo-titre" aria-describedby="chantier-alerte-meteo-aide chantier-alerte-meteo-gps"
                    onChange={e => setForm({ ...form, alerteMeteo: e.target.checked })} style={{ marginTop: 2 }} />
                  <span>
                    <strong id="chantier-alerte-meteo-titre">🔔 {isPt ? 'Alerta meteorológico por notificação' : 'Alerte météo par notification'}</strong>
                    <span id="chantier-alerte-meteo-aide" style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 2 }}>{aideAlerteMeteo(isPt)}</span>
                  </span>
                </label>
                {/* Zone toujours présente dont seul le contenu change : un lecteur d'écran annonce la note quand elle apparaît. */}
                <output id="chantier-alerte-meteo-gps" aria-live="polite">
                  {form.alerteMeteo && !positionPourAlerte(form.latitude, form.longitude) && (
                    <span style={{ display: 'block', fontSize: 11, color: '#BF360C', marginTop: 4 }}>{noteAlerteSansPosition(isPt)}</span>
                  )}
                </output>
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
