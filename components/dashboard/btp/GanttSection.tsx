'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from '../useThemeVars'
import { useBTPData, type OptionsModification } from '@/lib/hooks/use-btp-data'
import { supabase } from '@/lib/supabase'
import { lireDocumentsDesChantiers } from '@/lib/documents/societe-client'
import { MESSAGES_REFUS_DOCUMENTS, messageRefusDocuments } from '@/lib/documents/messages-refus'
import {
  MESSAGES_PERIODE, devisDeLObra, erreurPeriode, finDeTache, horaireAffiche, joursAffiches, memeLigne,
  type DevisDeLObra, type LigneDevisPlanifiable, type RefLigneDevis,
} from '@/lib/btp/gantt-taches-devis'

interface ChantierItem {
  id: string; titre: string; client: string; dateDebut: string
  dateFin: string; statut: string; equipe: string
  sousTaches?: SousTache[]
}

/** Délai de regroupement des écritures : un curseur qu'on fait glisser change de valeur à chaque pas. */
const DELAI_ENREGISTREMENT_MS = 600

/**
 * Sous-tâche du Gantt (colonne chantiers_btp.sous_taches). Depuis le 28/11/2026, une nouvelle tâche correspond à une
 * ligne d'un devis de l'obra (RefLigneDevis) et porte son horaire, valable chaque jour (heureDebut, heureFin : HH:MM).
 * Les sous-tâches d'avant n'ont ni l'un ni l'autre.
 */
interface SousTache extends RefLigneDevis {
  id: string; nom: string; chantierId: string; responsable: string
  debut: string; fin: string; avancement: number; couleur: string
  heureDebut?: string; heureFin?: string
}

/** Devis de l'obra choisie dans le formulaire « Nova tarefa ». `message` : refus du serveur, dans la langue de l'écran. */
type EtatDevisObra =
  | { chantierId: string; etat: 'chargement' }
  | { chantierId: string; etat: 'ok'; devis: DevisDeLObra[] }
  | { chantierId: string; etat: 'aucun_droit' }
  | { chantierId: string; etat: 'erreur'; message?: string }

/** Colonnes des devis lus pour le formulaire : les lignes (items) et le chantier rattaché. */
const COLONNES_DEVIS_GANTT = 'id, numero, items, chantier_id, created_at'

/** Titulaire de la société : devis de l'obra lus depuis le navigateur, sous RLS. */
async function lireDevisTitulaire(ficheId: string, chantierId: string): Promise<EtatDevisObra> {
  const { data, error } = await supabase.from('devis').select(COLONNES_DEVIS_GANTT)
    .eq('artisan_id', ficheId).eq('chantier_id', chantierId).is('deleted_at', null).order('created_at', { ascending: false })
  if (error) {
    console.error('[Gantt] devis de l’obra illisibles :', error.message)
    return { chantierId, etat: 'erreur' }
  }
  return { chantierId, etat: 'ok', devis: devisDeLObra((data ?? []) as unknown as Record<string, unknown>[], chantierId) }
}

/** Compte invité : devis de la société lus par le serveur (une lecture pour tout l'écran), ceux de l'obra gardés. */
async function lireDevisInvite(lecture: ReturnType<typeof lireDocumentsDesChantiers>, chantierId: string, isPt: boolean): Promise<EtatDevisObra> {
  const lu = await lecture
  if (lu.ok) return { chantierId, etat: 'ok', devis: devisDeLObra(lu.valeur.devis, chantierId) }
  console.error('[Gantt] devis de la société illisibles :', lu.message)
  if (lu.code === 'aucun_droit') return { chantierId, etat: 'aucun_droit' }
  const connu = !!lu.code && lu.code in MESSAGES_REFUS_DOCUMENTS
  return { chantierId, etat: 'erreur', message: connu ? messageRefusDocuments(lu, isPt) : undefined }
}

const FORM_VIDE = { chantierId: '', ligne: '', responsable: '', debut: '', fin: '', heureDebut: '08:00', heureFin: '17:00', couleur: '#3B82F6' }

const S_LABEL = { display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' } as const

/**
 * Listes de sous-tâches dont l'écriture n'est pas encore revenue (envoi puis relecture), par compte et par chantier
 * (relecture adverse du 15/11/2026). Un retour sur le Gantt pendant ce temps reprend la copie en mémoire des chantiers,
 * encore à l'état d'avant : l'ancien avancement s'affichait, puis était réécrit à la modification suivante.
 */
const _listesEnEnvoi = new Map<string, SousTache[]>()

type GanttRow = {
  id: string; nom: string; chantierId?: string; responsable: string
  debut: string; fin: string; avancement: number
  statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'
  couleur: string; isChantier: boolean
  /** Sous-tâche : horaire de chaque jour et devis de sa ligne (absents pour une sous-tâche d'avant le 28/11/2026). */
  heureDebut?: string; heureFin?: string; devisNumero?: string
}

function mapChantierStatut(statut: string, dateFin: string): GanttRow['statut'] {
  if (statut === 'Terminé') return 'terminé'
  if (statut === 'En attente') return 'planifié'
  if (dateFin && new Date(dateFin) < new Date()) return 'en_retard'
  return 'en_cours'
}

// Exact HTML mockup colors
const PALETTE = ['#42A5F5', '#66BB6A', '#FFA726', '#FFCA28', '#AB47BC', '#EF5350', '#42A5F5']
function getChantierColor(index: number): string { return PALETTE[index % PALETTE.length] }

function computeAvancement(dateDebut: string, dateFin: string): number {
  const s = new Date(dateDebut).getTime(), e = new Date(dateFin).getTime(), n = Date.now()
  if (n <= s) return 0
  if (n >= e) return 100
  return Math.round(((n - s) / (e - s)) * 100)
}

/** For a given row & month, return left/right % for the bar segment, or null if no overlap */
function getSegment(rowStart: number, rowEnd: number, mStart: number, mEnd: number) {
  if (rowEnd <= mStart || rowStart >= mEnd) return null
  const segStart = Math.max(rowStart, mStart)
  const segEnd = Math.min(rowEnd, mEnd)
  const span = mEnd - mStart
  return { left: ((segStart - mStart) / span) * 100, right: ((mEnd - segEnd) / span) * 100 }
}

// userId : fiche société (clés du navigateur, dont gantt_subtasks_) ; authUserId : compte, clé de cache commune aux
// écrans BTP (constat donnees-btp-15). devisParLeServeur : compte invité dans la société, dont la RLS ne rend aucun
// devis de l'entreprise (lus par /api/pro/documents/chantiers, comme la Météo et l'écran Obras).
export function GanttSection({ userId, authUserId, orgRole, devisParLeServeur = false }: {
  userId: string; authUserId?: string; orgRole?: string; devisParLeServeur?: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  void orgRole
  const tv = useThemeVars(true)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const isPt = locale === 'pt'

  const SUBTASKS_KEY = `gantt_subtasks_${userId}`
  const compte = authUserId || userId
  const { items: chantiers, loading, update } = useBTPData<ChantierItem>({ table: 'chantiers', artisanId: userId, userId: compte })

  const [sousTaches, setSousTaches] = useState<SousTache[]>(() => {
    try { return JSON.parse(localStorage.getItem(SUBTASKS_KEY) || '[]') } catch { return [] }
  })

  // ── Enregistrement en base (constat donnees-btp-8) ──
  // Par le hook (modification partielle de sous_taches) : sa copie en mémoire des chantiers suit l'écriture, et un
  // échec est annoncé. Avant, l'écriture directe laissait cette copie à l'ancien état, qui revenait au retour sur la
  // page puis était réécrit. Écritures regroupées, pour les seuls chantiers dont la liste a changé (la route accepte
  // 30 écritures par minute) ; celles en attente partent quand on quitte la page.
  const sousTachesRef = useRef(sousTaches)
  const updateRef = useRef(update)
  const aEnregistrer = useRef(new Set<string>())
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { sousTachesRef.current = sousTaches }, [sousTaches])
  useEffect(() => { updateRef.current = update }, [update])

  const enregistrerEnAttente = useCallback((options?: OptionsModification) => {
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = null
    const ids = [...aEnregistrer.current]
    aEnregistrer.current.clear()
    for (const cid of ids) {
      const liste = sousTachesRef.current.filter(st => st.chantierId === cid)
      const cle = `${compte}/${cid}`
      _listesEnEnvoi.set(cle, liste)
      void updateRef.current(cid, { sousTaches: liste }, options).finally(() => {
        if (_listesEnEnvoi.get(cle) === liste) _listesEnEnvoi.delete(cle)
      })
    }
  }, [compte])
  useEffect(() => () => enregistrerEnAttente(), [enregistrerEnAttente])

  // Rechargement, onglet fermé, passage à une autre application : la page ne se démonte pas. Les écritures en attente
  // partent tout de suite, en keepalive (la requête aboutit même si la page se ferme) ; avant, la modification restait
  // dans le navigateur et la base l'emportait au chargement suivant (relecture adverse du 15/11/2026).
  useEffect(() => {
    const envoyerAvantDePartir = () => { if (aEnregistrer.current.size > 0) enregistrerEnAttente({ keepalive: true }) }
    const siPageCachee = () => { if (document.visibilityState === 'hidden') envoyerAvantDePartir() }
    window.addEventListener('pagehide', envoyerAvantDePartir)
    document.addEventListener('visibilitychange', siPageCachee)
    return () => {
      window.removeEventListener('pagehide', envoyerAvantDePartir)
      document.removeEventListener('visibilitychange', siPageCachee)
    }
  }, [enregistrerEnAttente])

  // One-shot merge: once chantiers load from Supabase, pull their embedded sous_taches.
  // Supabase wins per chantier; localStorage items for unknown chantiers are kept.
  // Une liste en cours d'envoi l'emporte sur la copie en mémoire, encore à l'état d'avant l'écriture.
  const sbMergedRef = useRef(false)
  useEffect(() => {
    if (sbMergedRef.current || chantiers.length === 0) return
    const sbItems: SousTache[] = chantiers.flatMap(
      c => _listesEnEnvoi.get(`${compte}/${c.id}`) ?? ((c as unknown as { sousTaches?: SousTache[] }).sousTaches || [])
    )
    if (sbItems.length === 0) return
    sbMergedRef.current = true
    setSousTaches(prev => {
      const sbChantierIds = new Set(sbItems.map(st => st.chantierId))
      const lsOnly = prev.filter(st => !sbChantierIds.has(st.chantierId))
      return [...sbItems, ...lsOnly]
    })
  }, [chantiers, compte])

  // Persist sous-taches: localStorage (comme avant) + base, chantier par chantier, pour ceux dont la liste change
  const saveST = (d: SousTache[]) => {
    // Liste du rendu dont part la modification (d en est tiré) : la copie de sousTachesRef n'est mise à jour qu'après
    // l'affichage, et un changement fait juste après la fusion du montage la trouvait encore vide (tous les chantiers
    // réécrits).
    const avant = sousTaches
    setSousTaches(d)
    sousTachesRef.current = d
    localStorage.setItem(SUBTASKS_KEY, JSON.stringify(d))
    const listeDe = (liste: SousTache[], cid: string) => JSON.stringify(liste.filter(st => st.chantierId === cid))
    for (const c of chantiers) {
      // Une liste vidée (dernière sous-tâche supprimée) est écrite elle aussi : [] en base.
      if (listeDe(avant, c.id) !== listeDe(d, c.id)) aEnregistrer.current.add(c.id)
    }
    if (aEnregistrer.current.size === 0) return
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => enregistrerEnAttente(), DELAI_ENREGISTREMENT_MS)
  }
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_VIDE)

  // ── Devis de l'obra choisie : chaque tâche correspond à une de leurs lignes ──
  // Lus au choix de l'obra et gardés pour la durée de l'écran ; une réponse dépassée (autre obra choisie entre-temps)
  // est ignorée. Titulaire : lecture directe sous RLS, obra par obra. Compte invité : le serveur rend tous les devis de
  // la société, lus une fois pour l'écran (la route est limitée à 30 lectures par minute, partagées avec Obras et Météo).
  const [devisObra, setDevisObra] = useState<EtatDevisObra | null>(null)
  const demandeDevisRef = useRef(0)
  const devisLusRef = useRef(new Map<string, DevisDeLObra[]>())
  const lectureSocieteRef = useRef<ReturnType<typeof lireDocumentsDesChantiers> | null>(null)

  const chargerDevisObra = useCallback(async (chantierId: string, relire = false) => {
    const demande = ++demandeDevisRef.current
    const dejaLus = relire ? undefined : devisLusRef.current.get(chantierId)
    if (dejaLus) { setDevisObra({ chantierId, etat: 'ok', devis: dejaLus }); return }
    setDevisObra({ chantierId, etat: 'chargement' })
    let resultat: EtatDevisObra
    try {
      if (devisParLeServeur) {
        if (relire || !lectureSocieteRef.current) lectureSocieteRef.current = lireDocumentsDesChantiers()
        const lecture = lectureSocieteRef.current
        resultat = await lireDevisInvite(lecture, chantierId, isPt)
        // Une lecture en échec n'est pas gardée : le choix suivant réessaie.
        if (resultat.etat !== 'ok' && lectureSocieteRef.current === lecture) lectureSocieteRef.current = null
      } else {
        resultat = await lireDevisTitulaire(userId, chantierId)
      }
    } catch (e) {
      console.error('[Gantt] lecture des devis de l’obra :', e)
      lectureSocieteRef.current = null
      resultat = { chantierId, etat: 'erreur' }
    }
    if (demande !== demandeDevisRef.current) return
    if (resultat.etat === 'ok') devisLusRef.current.set(chantierId, resultat.devis)
    setDevisObra(resultat)
  }, [devisParLeServeur, userId, isPt])

  const choisirObra = (chantierId: string) => {
    setForm(f => ({ ...f, chantierId, ligne: '' }))
    if (chantierId) void chargerDevisObra(chantierId)
    else { demandeDevisRef.current += 1; setDevisObra(null) }
  }

  const devisDeLObraChoisie = devisObra?.chantierId === form.chantierId && devisObra.etat === 'ok' ? devisObra.devis : []
  const lignesObra: LigneDevisPlanifiable[] = devisDeLObraChoisie.flatMap(d => d.lignes)
  const ligneChoisie = lignesObra.find(l => l.cle === form.ligne) ?? null
  const erreurForm = erreurPeriode(form)
  // Jours non encore saisis : le bouton grisé suffit. Les autres incohérences se disent.
  const messagePeriode = erreurForm && erreurForm !== 'jours_manquants' ? MESSAGES_PERIODE[erreurForm][isPt ? 'pt' : 'fr'] : ''
  const peutAjouter = !!form.chantierId && !!ligneChoisie && erreurForm === null
  const idForm = useId()

  /** Première option de la liste des lignes : ce qu'il faut faire avant de pouvoir choisir. */
  const texteChoixLigne = (): string => {
    if (!form.chantierId) return isPt ? 'Escolha primeiro a obra' : 'Choisissez d’abord le chantier'
    if (devisObra?.etat === 'chargement') return isPt ? 'A carregar os orçamentos...' : 'Chargement des devis...'
    if (lignesObra.length > 0) return isPt ? 'Selecionar...' : 'Sélectionner...'
    return isPt ? 'Nenhuma linha disponível' : 'Aucune ligne disponible'
  }

  /** Pourquoi la liste des lignes est vide, une fois la lecture des devis de l'obra revenue. */
  const messageDevis = (): string => {
    if (!form.chantierId || !devisObra || devisObra.chantierId !== form.chantierId) return ''
    if (devisObra.etat === 'erreur') {
      return devisObra.message ?? (isPt ? 'Não foi possível ler os orçamentos desta obra.' : 'Les devis de ce chantier n’ont pas pu être lus.')
    }
    if (devisObra.etat === 'aucun_droit') {
      return isPt
        ? 'A sua função na empresa não dá acesso aos orçamentos: peça ao gerente para planear esta tarefa.'
        : 'Votre rôle dans l’entreprise ne donne pas accès aux devis : demandez au gérant de planifier cette tâche.'
    }
    if (devisObra.etat !== 'ok' || lignesObra.length > 0) return ''
    if (devisObra.devis.length > 0) return isPt ? 'Os orçamentos desta obra não têm linhas.' : 'Les devis de ce chantier n’ont aucune ligne.'
    return isPt
      ? 'Esta obra não tem orçamento associado. Associe um orçamento a esta obra no módulo Obras para planear as suas linhas.'
      : 'Ce chantier n’a aucun devis lié. Liez un devis à ce chantier dans l’onglet Chantiers pour planifier ses lignes.'
  }
  const messageLignes = messageDevis()

  /** Désignation de la ligne (coupée à 100 caractères), sa quantité, et si elle est déjà planifiée sur cette obra. */
  const libelleLigne = (l: LigneDevisPlanifiable) => {
    const nom = l.description.length > 100 ? `${l.description.slice(0, 99)}…` : l.description
    const planifiee = sousTaches.some(st => st.chantierId === form.chantierId && memeLigne(st, l))
    return `${nom}${l.quantite ? ` (${l.quantite})` : ''}${planifiee ? (isPt ? ' · já planeada' : ' · déjà planifiée') : ''}`
  }

  const fermerFormulaire = () => {
    setShowForm(false)
    setForm(FORM_VIDE)
    demandeDevisRef.current += 1
    setDevisObra(null)
  }

  // Une obra et une ligne de l'un de ses devis sont exigées (sans obra, la tâche n'apparaissait nulle part), avec les
  // jours et l'horaire. Le nom de la tâche est la désignation de la ligne.
  const addSousTache = () => {
    if (!peutAjouter || !ligneChoisie) return
    saveST([...sousTaches, {
      id: Date.now().toString(), nom: ligneChoisie.description, chantierId: form.chantierId,
      responsable: form.responsable.trim(), debut: form.debut, fin: form.fin,
      heureDebut: form.heureDebut, heureFin: form.heureFin, avancement: 0, couleur: form.couleur,
      devisId: ligneChoisie.devisId, devisNumero: ligneChoisie.devisNumero,
      ligneId: ligneChoisie.ligneId, ligneIndex: ligneChoisie.ligneIndex,
    }])
    fermerFormulaire()
  }
  const updateAvancement = (id: string, val: number) => saveST(sousTaches.map(st => st.id === id ? { ...st, avancement: val } : st))
  const deleteSousTache = (id: string) => saveST(sousTaches.filter(st => st.id !== id))

  // Build rows
  const active = chantiers.filter(c => c.dateDebut && c.dateFin && c.statut !== 'Terminé')
  const rows: GanttRow[] = []
  active.forEach((c, idx) => {
    rows.push({
      id: c.id, nom: c.client || c.titre, responsable: c.equipe || c.client || '',
      debut: c.dateDebut, fin: c.dateFin, avancement: computeAvancement(c.dateDebut, c.dateFin),
      statut: mapChantierStatut(c.statut, c.dateFin), couleur: getChantierColor(idx), isChantier: true,
    })
    sousTaches.filter(st => st.chantierId === c.id).forEach(st => {
      // Avec un horaire, en retard après l'heure de fin du dernier jour (et non dès le matin de ce jour).
      const overdue = st.avancement < 100 && finDeTache(st) < new Date()
      rows.push({
        id: st.id, nom: st.nom, chantierId: c.id, responsable: st.responsable,
        debut: st.debut, fin: st.fin, avancement: st.avancement,
        statut: st.avancement >= 100 ? 'terminé' : overdue ? 'en_retard' : st.avancement > 0 ? 'en_cours' : 'planifié',
        couleur: st.couleur, isChantier: false,
        heureDebut: st.heureDebut, heureFin: st.heureFin, devisNumero: st.devisNumero,
      })
    })
  })

  // Timeline months — pad 1 month before/after, minimum 7 months displayed
  const allDates = rows.flatMap(r => [new Date(r.debut), new Date(r.fin)]).filter(d => !isNaN(d.getTime()))
  const rawMin = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const rawMax = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 90 * 86400000)
  // Pad: 1 month before earliest, 1 month after latest
  const minDate = new Date(rawMin.getFullYear(), rawMin.getMonth() - 1, 1)
  const padMax = new Date(rawMax.getFullYear(), rawMax.getMonth() + 2, 0)
  // Ensure at least 7 months displayed
  const minMonths = 7
  let maxDate = padMax
  const diffMonths = (padMax.getFullYear() - minDate.getFullYear()) * 12 + padMax.getMonth() - minDate.getMonth() + 1
  if (diffMonths < minMonths) {
    maxDate = new Date(minDate.getFullYear(), minDate.getMonth() + minMonths - 1, 28)
  }

  const months: { label: string; start: Date; end: Date }[] = []
  if (rows.length > 0) {
    const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      const start = new Date(d)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      months.push({ label: start.toLocaleDateString(dateLocale, { month: 'short' }).replace('.', '').toUpperCase(), start, end })
      d.setMonth(d.getMonth() + 1)
    }
  }

  /** Progress-line position: where the row's avancement % falls within a month cell, or null */
  const progressInMonth = (row: GanttRow, m: { start: Date; end: Date }) => {
    const rStart = new Date(row.debut).getTime()
    const rEnd = new Date(row.fin).getTime()
    const progressTime = rStart + (rEnd - rStart) * (row.avancement / 100)
    const ms = m.start.getTime(), me = m.end.getTime()
    if (progressTime < ms || progressTime > me) return null
    return ((progressTime - ms) / (me - ms)) * 100
  }

  const statusColor = (s: GanttRow['statut']) =>
    s === 'en_cours' ? '#42A5F5' : s === 'en_retard' ? '#EF5350' : s === 'terminé' ? '#BDBDBD' : '#AB47BC'

  const statLabels: Record<string, string> = {
    planifié: t('proDash.btp.gantt.planifie'),
    en_cours: t('proDash.btp.gantt.enCours'),
    terminé: t('proDash.btp.gantt.termine'),
    en_retard: t('proDash.btp.gantt.enRetard'),
  }

  const subTasks = rows.filter(r => !r.isChantier)

  /** Devis de la ligne planifiée, jours et horaire d'une tâche (vides pour une sous-tâche d'avant le 28/11/2026). */
  const refDevis = (row: GanttRow) => (row.devisNumero ? `${isPt ? 'Orçamento' : 'Devis'} ${row.devisNumero}` : '')
  const horaireTache = (row: GanttRow) => horaireAffiche(row.heureDebut, row.heureFin, isPt)
  const infoTache = (row: GanttRow) =>
    [row.nom, refDevis(row), [joursAffiches(row.debut, row.fin), horaireTache(row)].filter(Boolean).join(', ')].filter(Boolean).join('\n')

  // CSS-in-JS matching HTML mockup exactly
  const S = {
    gantt: { overflowX: 'auto' as const, border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff' },
    grid: { display: 'grid' as const, gridTemplateColumns: `180px repeat(${months.length}, 1fr)`, minWidth: 900 },
    hdr: { display: 'contents' as const },
    hdrCell: { padding: '6px 8px', fontSize: 10, fontWeight: 700 as const, textTransform: 'uppercase' as const, color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'center' as const },
    hdrFirst: { padding: '6px 8px', paddingLeft: 12, fontSize: 10, fontWeight: 700 as const, textTransform: 'uppercase' as const, color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'left' as const },
    row: { display: 'contents' as const },
    cell: { padding: '6px 4px', borderBottom: '1px solid #F0F0F0', fontSize: 11, position: 'relative' as const, height: 36 },
    nameCell: { padding: '6px 8px', paddingLeft: 12, borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600 as const, display: 'flex' as const, alignItems: 'center' as const, lineHeight: 1.3, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const },
    bar: { height: 18, borderRadius: 3, position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', minWidth: 4 },
    barLabel: { position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', left: 6, fontSize: 9, fontWeight: 600 as const, color: '#fff', whiteSpace: 'nowrap' as const },
    progressLine: { position: 'absolute' as const, top: 2, bottom: 2, width: 2, background: '#E53935', zIndex: 2, borderRadius: 1 },
    diamond: { width: 10, height: 10, background: '#FFC107', transform: 'rotate(45deg)', position: 'absolute' as const, top: '50%', marginTop: -5, zIndex: 3 },
  }

  return (
    <div>
      {/* Header */}
      <div className="v5-pg-t" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h1>{isPt ? 'Planeamento Gantt' : 'Planification Gantt'}</h1>
          <p>{isPt ? 'Vista geral das obras' : 'Vue d\'ensemble des chantiers'}{isPt ? (months.length >= 2 ? ': ' : '') : ' — '}{months.length >= 2 ? `${months[0].label} → ${months[months.length - 1].label} ${months[months.length - 1].start.getFullYear()}` : ''}</p>
        </div>
        {active.length > 0 && (
          <button className="v5-btn v5-btn-p" onClick={() => setShowForm(true)}>+ {isPt ? 'Tarefa' : 'Sous-tâche'}</button>
        )}
      </div>

      {/* Add sub-task form */}
      {showForm && (
        <div className="v5-card" style={{ marginBottom: '1.25rem' }}>
          <div className="v5-st">{isPt ? 'Nova tarefa' : 'Nouvelle sous-tâche'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '.75rem' }}>
            <div>
              <label htmlFor={`${idForm}-obra`} style={S_LABEL}>{isPt ? 'Obra' : 'Chantier'}</label>
              <select id={`${idForm}-obra`} className="v5-fi" value={form.chantierId} onChange={e => choisirObra(e.target.value)}>
                <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                {active.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <label htmlFor={`${idForm}-ligne`} style={S_LABEL}>{isPt ? 'Linha do orçamento' : 'Ligne du devis'}</label>
              <select
                id={`${idForm}-ligne`} className="v5-fi" style={{ width: '100%' }} value={form.ligne}
                disabled={lignesObra.length === 0} onChange={e => setForm({ ...form, ligne: e.target.value })}
              >
                <option value="">{texteChoixLigne()}</option>
                {devisDeLObraChoisie.filter(d => d.lignes.length > 0).map(d => (
                  <optgroup key={d.id} label={`${isPt ? 'Orçamento' : 'Devis'} ${d.numero || (isPt ? 'sem número' : 'sans numéro')}`}>
                    {d.lignes.map(l => <option key={l.cle} value={l.cle}>{libelleLigne(l)}</option>)}
                  </optgroup>
                ))}
              </select>
              {messageLignes && (
                <div role="status" style={{ fontSize: 11, color: devisObra?.etat === 'erreur' ? '#C62828' : '#666', marginTop: 4 }}>
                  {messageLignes}
                  {devisObra?.etat === 'erreur' && (
                    <button type="button" onClick={() => { void chargerDevisObra(form.chantierId, true) }}
                      style={{ marginLeft: 6, background: 'none', border: 'none', padding: 0, color: '#1565C0', textDecoration: 'underline', cursor: 'pointer', fontSize: 11 }}>
                      {isPt ? 'Tentar de novo' : 'Réessayer'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label htmlFor={`${idForm}-debut`} style={S_LABEL}>{isPt ? 'Dia de início' : 'Jour de début'}</label>
              <input id={`${idForm}-debut`} type="date" className="v5-fi" value={form.debut} onChange={e => setForm({ ...form, debut: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${idForm}-fin`} style={S_LABEL}>{isPt ? 'Dia de fim' : 'Jour de fin'}</label>
              <input id={`${idForm}-fin`} type="date" className="v5-fi" min={form.debut || undefined} value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${idForm}-responsable`} style={S_LABEL}>{isPt ? 'Responsável' : 'Responsable'}</label>
              <input id={`${idForm}-responsable`} className="v5-fi" value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${idForm}-heure-debut`} style={S_LABEL}>{isPt ? 'Hora de início' : 'Heure de début'}</label>
              <input id={`${idForm}-heure-debut`} type="time" className="v5-fi" value={form.heureDebut} onChange={e => setForm({ ...form, heureDebut: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${idForm}-heure-fin`} style={S_LABEL}>{isPt ? 'Hora de fim' : 'Heure de fin'}</label>
              <input id={`${idForm}-heure-fin`} type="time" className="v5-fi" value={form.heureFin} onChange={e => setForm({ ...form, heureFin: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`${idForm}-couleur`} style={S_LABEL}>{isPt ? 'Cor' : 'Couleur'}</label>
              <input id={`${idForm}-couleur`} type="color" className="v5-fi" style={{ height: 34, padding: '2px 4px' }} value={form.couleur} onChange={e => setForm({ ...form, couleur: e.target.value })} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: '.5rem' }}>
            {isPt ? 'As horas aplicam-se a cada dia, do dia de início ao dia de fim.' : 'Les heures valent pour chaque jour, du jour de début au jour de fin.'}
          </div>
          {messagePeriode && <div role="alert" style={{ fontSize: 11, color: '#C62828', marginBottom: '.5rem' }}>{messagePeriode}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="v5-btn v5-btn-p" onClick={addSousTache} disabled={!peutAjouter}>{isPt ? 'Adicionar' : 'Ajouter'}</button>
            <button className="v5-btn" style={{ background: 'none', border: '1px solid #E8E8E8' }} onClick={fermerFormulaire}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          </div>
        </div>
      )}

      {/* Gantt Chart — exact HTML mockup structure */}
      {loading ? (
        <div style={{ ...S.gantt, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#999' }}>{isPt ? 'A carregar...' : 'Chargement...'}</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...S.gantt, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma obra com datas' : 'Aucun chantier avec des dates'}</div>
          <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie obras com datas no módulo Obras' : 'Créez des chantiers avec dates dans l\'onglet Chantiers'}</p>
        </div>
      ) : (
        <>
          <div style={S.gantt}>
            <div style={S.grid}>
              {/* ── Header ── */}
              <div style={S.hdr}>
                <div style={S.hdrFirst}>{isPt ? 'Obra' : 'Chantier'}</div>
                {months.map((m, i) => <div key={i} style={S.hdrCell}>{m.label}</div>)}
              </div>

              {/* ── Rows ── */}
              {rows.map(row => {
                const color = row.isChantier ? row.couleur : (row.couleur || statusColor(row.statut))
                const isRetard = row.statut === 'en_retard'
                const isTermine = row.statut === 'terminé'
                const isPlanifie = row.statut === 'planifié'
                const rStart = new Date(row.debut).getTime()
                const rEnd = new Date(row.fin).getTime()

                // Find which month has the most bar coverage (for placing the % label)
                let labelIdx = -1, bestW = 0
                months.forEach((m, i) => {
                  const seg = getSegment(rStart, rEnd, m.start.getTime(), m.end.getTime())
                  if (seg) { const w = 100 - seg.left - seg.right; if (w > bestW) { bestW = w; labelIdx = i } }
                })

                return (
                  <div key={`${row.isChantier ? 'c' : 't'}-${row.id}`} style={S.row}>
                    {/* Name */}
                    <div title={row.isChantier ? undefined : infoTache(row)} style={{
                      ...S.nameCell,
                      ...(isTermine ? { color: '#999', textDecoration: 'line-through' } : {}),
                      ...(isRetard ? { color: '#C62828' } : {}),
                      ...(!row.isChantier ? { paddingLeft: 24, fontWeight: 400 as const } : {}),
                    }}>
                      {row.nom}
                      {isTermine && row.isChantier && ' ✓'}
                      {isRetard && ' ⚠️'}
                      {!row.isChantier && (
                        <button onClick={() => deleteSousTache(row.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 9, padding: '0 4px' }} title={isPt ? 'Eliminar' : 'Supprimer'}>✕</button>
                      )}
                    </div>

                    {/* Month cells */}
                    {months.map((m, mi) => {
                      const seg = getSegment(rStart, rEnd, m.start.getTime(), m.end.getTime())
                      const pp = progressInMonth(row, m)

                      return (
                        <div key={mi} style={S.cell}>
                          {seg && (
                            <div style={{
                              ...S.bar,
                              left: `${seg.left}%`,
                              right: `${seg.right}%`,
                              background: isTermine ? '#BDBDBD' : color,
                              opacity: isPlanifie ? 0.5 : 1,
                            }}>
                              {mi === labelIdx && (
                                <span style={{ ...S.barLabel, color: color === '#FFCA28' ? '#333' : '#fff' }}>
                                  {row.avancement}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Progress line — per-row, positioned at avancement % within the bar */}
                          {row.isChantier && pp !== null && row.avancement > 0 && row.avancement < 100 && (
                            <div style={{ ...S.progressLine, left: `${pp}%` }} />
                          )}

                          {/* Diamond milestone at end of last segment */}
                          {row.isChantier && seg && mi < months.length - 1 && !getSegment(rStart, rEnd, months[mi + 1].start.getTime(), months[mi + 1].end.getTime()) && seg.right > 5 && (
                            <div style={{ ...S.diamond, right: `${Math.max(1, seg.right - 3)}%` }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ marginTop: 8, fontSize: 10, color: '#999' }}>
            🔴 {isPt ? 'Linha vermelha = avanço real da obra' : 'Ligne rouge = avancement réel du chantier'} &nbsp;&bull;&nbsp; 🔶 {isPt ? 'Losango = marco principal' : 'Losange = jalon clé'}
          </div>

          {/* Sub-task table */}
          {subTasks.length > 0 && (
            <div style={{ ...S.gantt, marginTop: 12 }}>
              <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#333', borderBottom: '1px solid #E8E8E8', background: '#FAFAFA' }}>
                {isPt ? 'Avanço das tarefas' : 'Avancement des tâches'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[isPt ? 'Tarefa' : 'Tâche', isPt ? 'Obra' : 'Chantier', isPt ? 'Dias e horário' : 'Jours et horaire', isPt ? 'Estado' : 'Statut', isPt ? 'Avanço' : 'Avancement'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subTasks.map(row => {
                    const ch = chantiers.find(c => c.id === row.chantierId)
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600 }}>
                          {row.nom}
                          {row.devisNumero && <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{refDevis(row)}</div>}
                          {row.responsable && <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{row.responsable}</div>}
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>{ch?.titre || '—'}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {joursAffiches(row.debut, row.fin) || '—'}
                          {horaireTache(row) && <div style={{ fontSize: 10, color: '#666' }}>{horaireTache(row)}</div>}
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                            background: row.statut === 'en_cours' ? '#E3F2FD' : row.statut === 'terminé' ? '#F5F5F5' : row.statut === 'en_retard' ? '#FFEBEE' : '#F3E5F5',
                            color: row.statut === 'en_cours' ? '#1565C0' : row.statut === 'terminé' ? '#757575' : row.statut === 'en_retard' ? '#C62828' : '#7B1FA2',
                          }}>{statLabels[row.statut] || row.statut}</span>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                              <div style={{ width: `${row.avancement}%`, height: '100%', borderRadius: 3, background: statusColor(row.statut) }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, minWidth: 28 }}>{row.avancement}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={row.avancement}
                            onChange={e => updateAvancement(row.id, Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#FFC107', height: 4, marginTop: 4 }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
              <div key={s} style={{ border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>{statLabels[s]}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: statusColor(s) }}>{rows.filter(r => r.statut === s).length}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
