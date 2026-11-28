// E-mail de la veille au soir de l'alerte météo (décision de Frédéric du 26/11/2026 : « soumettre un chantier à
// l'alerte météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il pleut »). Appelé chaque
// soir par la route app/api/cron/alerte-meteo, que déclenche le Cron Trigger du Worker (worker/taches-planifiees.ts).
//   - chantiers soumis à l'alerte (chantiers_btp.alerte_meteo, migration 20261126b) suivis demain : « En cours », ou
//     « En attente » dont demain est le premier jour (chantierSuiviLe, la règle du téléphone) ; colonne absente : rien ;
//   - prévision Open-Meteo du chantier, délai borné ; « demain » et l'heure sont ceux du chantier (décalage horaire de
//     la réponse) ; hors de la plage d'envoi à l'heure du chantier (FENETRE_ENVOI, 12 h - 23 h : de l'Europe aux
//     Antilles et à La Réunion pour un passage à 18:15 UTC), rien n'est envoyé : un appel en retard ou lancé à la main
//     ne prévient pas en pleine nuit pour le mauvais jour ;
//   - destinataires : les salariés actifs affectés au chantier (directement ou par leur équipe) qui ont une adresse
//     e-mail, une fois chacune, qu'ils aient l'appli ou non (le serveur ne sait pas ce que le téléphone a programmé) ;
//     langue et nom de la fiche de la société ;
//   - un lot Resend par chantier, clé d'idempotence (jour + chantier), une seconde entre deux lots (débit commun à
//     tout Vitfix) ;
//   - un chantier sans aucun destinataire n'est pas lu (ni prévision, ni place dans la limite) ;
//   - au plus CHANTIERS_PAR_APPEL chantiers et DUREE_PASSAGE_MAX_MS par appel (un Cron Trigger a 15 min, rejeu
//     compris) : le reste est compté (`nonTraites`), signalé à Sentry par la route, jamais passé sous silence ;
//   - `rejouer` : un lot en panne passagère, une société illisible, une prévision demandée sans réponse, ou la durée
//     dépassée ; le second appel n'envoie rien en double (même clé d'idempotence ; les messages sont rangés dans le même
//     ordre, et un lot dont le texte a changé entre-temps, la prévision ayant été republiée, revient en 409 : il est
//     compté `dejaTraites`, il était parti) ; `lotsEnEchec` compte les lots non envoyés, que la route signale à Sentry.
// Journal : identifiants et nombres seulement, jamais d'adresse ni de position.

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sendBatchEmailsDetaille, templateGenericNotif, type ResultatLotEmailDetaille } from '@/lib/email'
import { urlPrevisionsMeteo } from '@/lib/btp/meteo-url'
import {
  STATUT_EN_ATTENTE,
  alerteDuJour,
  chantierSuiviLe,
  dateDecalee,
  debutDuChantier,
  decalageDuChantier,
  joursDePrevisions,
  momentAuChantier,
  texteAlerteDuLendemain,
  type JourPrevu,
} from '@/lib/btp/alerte-meteo'
import { STATUT_EN_COURS, estAffecte, type ChantierBtp, type EquipeBtp, type MembreBtp } from '@/lib/btp/pointage-regles'

/** Au plus autant de chantiers traités (un appel Open-Meteo chacun) par appel. */
export const CHANTIERS_PAR_APPEL = 100
/** Lignes lues pour trouver les sociétés concernées (une ligne par chantier soumis). */
export const LIGNES_SOCIETES_MAX = 1000
/** Durée maximale d'un appel : deux appels (rejeu du Worker compris, une minute d'écart) tiennent dans 15 min. */
export const DUREE_PASSAGE_MAX_MS = 6 * 60_000
export const DELAI_PREVISION_MS = 8000
export const PAUSE_ENTRE_LOTS_MS = 1000
/** Plage d'envoi, en heures locales du chantier [début, fin) : l'e-mail ne part que dans cette plage. */
export const FENETRE_ENVOI = { debut: 12, fin: 23 } as const

const COLONNE_ABSENTE = new Set(['42703', 'PGRST204'])
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATUTS_LUS = [STATUT_EN_COURS, STATUT_EN_ATTENTE]

export interface BilanAlerteMeteo {
  societes: number
  chantiers: number
  alertes: number
  emails: number
  refuses: number
  sansPosition: number
  previsionsIndisponibles: number
  horsFenetre: number
  /** Chantiers laissés de côté : au-delà de CHANTIERS_PAR_APPEL, ou de DUREE_PASSAGE_MAX_MS. */
  nonTraites: number
  /** Chantiers suivis sans aucun salarié à prévenir par e-mail (ni prévision lue, ni place dans la limite). */
  sansDestinataire: number
  /** Lots d'e-mails non envoyés (panne, débit, quota, refus, configuration). */
  lotsEnEchec: number
  /** Lots revenus en 409 au rejeu : déjà traités au premier appel, avec un texte qui a changé depuis. */
  dejaTraites: number
  /** Liste des sociétés coupée à LIGNES_SOCIETES_MAX : les suivantes ne sont pas traitées. */
  societesCoupees: boolean
  raison?: 'colonne_absente'
}

export interface ResultatAlerteMeteo {
  bilan: BilanAlerteMeteo
  /** Vrai s'il faut rejouer l'appel (sans risque de doublon) : la route répond alors 503. */
  rejouer: boolean
}

export interface DependancesAlerteMeteo {
  /** Instant de référence (« demain » et la plage d'envoi au chantier). */
  maintenantMs: number
  /** Horloge réelle, pour borner la durée de l'appel. */
  horloge: () => number
  attendre: (ms: number) => Promise<void>
  /** Lecture HTTP (fetch), appelée comme une fonction. */
  lire: (url: string, init?: RequestInit) => Promise<Response>
}

interface Fiche {
  nom: string
  isPt: boolean
}

interface ChantierAlerte extends ChantierBtp {
  alerte_meteo?: boolean | null
  date_debut?: string | null
}

type Prevision =
  | { etat: 'sansPosition' | 'previsionsIndisponibles' | 'horsFenetre' }
  | { etat: 'lue'; demain: string; jours: JourPrevu[] }

interface Passage {
  bilan: BilanAlerteMeteo
  dep: DependancesAlerteMeteo
  lots: number
  budget: number
  /** Heure (horloge) au-delà de laquelle plus aucun chantier n'est commencé. */
  finMs: number
  rejouer: boolean
}

const bilanVide = (): BilanAlerteMeteo => ({
  societes: 0, chantiers: 0, alertes: 0, emails: 0, refuses: 0, sansPosition: 0, previsionsIndisponibles: 0, horsFenetre: 0,
  nonTraites: 0, sansDestinataire: 0, lotsEnEchec: 0, dejaTraites: 0, societesCoupees: false,
})

/** Sociétés qui ont au moins un chantier soumis à l'alerte, en cours ou en attente ; colonne absente : la raison. */
async function societesConcernees(): Promise<{ ids: string[]; coupee: boolean } | 'colonne_absente'> {
  const { data, error } = await supabaseAdmin
    .from('chantiers_btp')
    .select('owner_id')
    .eq('alerte_meteo', true)
    .in('statut', STATUTS_LUS)
    .order('owner_id')
    .limit(LIGNES_SOCIETES_MAX)
  if (error) {
    if (COLONNE_ABSENTE.has(String(error.code))) return 'colonne_absente'
    throw new Error(`lecture des chantiers : ${error.code}`)
  }
  const lignes = (data ?? []) as Array<{ owner_id?: string | null }>
  const coupee = lignes.length >= LIGNES_SOCIETES_MAX
  if (coupee) logger.warn('[cron/alerte-meteo] liste des sociétés coupée : les suivantes ne sont pas traitées', { lignes: lignes.length })
  const ids = [...new Set(lignes.map(l => l.owner_id).filter((id): id is string => typeof id === 'string' && id !== ''))]
  return { ids, coupee }
}

/** Nom et langue de chaque société ; lecture en échec : exception (rien n'est envoyé, l'appel est à rejouer). */
async function fichesDesSocietes(ids: readonly string[]): Promise<Map<string, Fiche>> {
  const fiches = new Map<string, Fiche>()
  if (ids.length === 0) return fiches
  const { data, error } = await supabaseAdmin.from('profiles_artisan').select('user_id, company_name, language').in('user_id', [...ids])
  if (error) throw new Error(`lecture des fiches des sociétés : ${error.code}`)
  for (const f of (data ?? []) as Array<{ user_id: string; company_name?: string | null; language?: string | null }>) {
    if (!fiches.has(f.user_id)) fiches.set(f.user_id, { nom: f.company_name?.trim() || 'Vitfix', isPt: f.language === 'pt' })
  }
  return fiches
}

/** Chantiers soumis (en cours ou en attente), employés et équipes de la société. */
async function lireSociete(societeId: string): Promise<{ chantiers: ChantierAlerte[]; membres: MembreBtp[]; equipes: EquipeBtp[] }> {
  const [chantiersRes, membresRes, equipesRes] = await Promise.all([
    supabaseAdmin.from('chantiers_btp').select('*').eq('owner_id', societeId).eq('alerte_meteo', true).in('statut', STATUTS_LUS)
      .order('id').limit(LIGNES_SOCIETES_MAX),
    supabaseAdmin.from('membres_btp').select('*').eq('owner_id', societeId).order('id').limit(500),
    supabaseAdmin.from('equipes_btp').select('*, equipe_membres_btp(membre_id)').eq('owner_id', societeId).limit(200),
  ])
  const erreur = chantiersRes.error || membresRes.error || equipesRes.error
  if (erreur) throw new Error(`lecture de la société : ${erreur.code}`)
  return {
    chantiers: (chantiersRes.data ?? []) as ChantierAlerte[],
    membres: (membresRes.data ?? []) as MembreBtp[],
    equipes: (equipesRes.data ?? []) as EquipeBtp[],
  }
}

/**
 * Le chantier peut-il être suivi demain ? Sans la prévision, « demain » au chantier n'est connu qu'à un jour près : un
 * chantier « En attente » n'est lu que s'il commence entre aujourd'hui et après-demain (dates UTC), le reste attend.
 */
function candidatDeDemain(chantier: ChantierAlerte, maintenantMs: number): boolean {
  if (chantier.statut === STATUT_EN_COURS) return true
  const debut = debutDuChantier(chantier)
  const aujourdhui = new Date(maintenantMs).toISOString().slice(0, 10)
  return debut !== null && debut >= aujourdhui && debut <= dateDecalee(aujourdhui, 2)
}

/** Prévision du chantier, et « demain » à l'heure du chantier ; hors de la plage d'envoi : rien à envoyer. */
async function previsionDuChantier(chantier: ChantierAlerte, dep: DependancesAlerteMeteo): Promise<Prevision> {
  const url = urlPrevisionsMeteo(chantier.latitude, chantier.longitude)
  if (!url) return { etat: 'sansPosition' }
  try {
    const reponse = await dep.lire(url, { signal: AbortSignal.timeout(DELAI_PREVISION_MS) })
    if (!reponse.ok) {
      logger.warn('[cron/alerte-meteo] prévision indisponible', { chantier: chantier.id, statut: reponse.status })
      return { etat: 'previsionsIndisponibles' }
    }
    const corps: unknown = await reponse.json()
    const decalage = decalageDuChantier(corps)
    if (decalage === null) {
      logger.warn('[cron/alerte-meteo] prévision sans décalage horaire', { chantier: chantier.id })
      return { etat: 'previsionsIndisponibles' }
    }
    const moment = momentAuChantier(dep.maintenantMs, decalage)
    if (moment.heure < FENETRE_ENVOI.debut || moment.heure >= FENETRE_ENVOI.fin) return { etat: 'horsFenetre' }
    return { etat: 'lue', demain: moment.demain, jours: joursDePrevisions(corps) }
  } catch (err) {
    logger.warn('[cron/alerte-meteo] prévision illisible', { chantier: chantier.id, erreur: err instanceof Error ? err.name : typeof err })
    return { etat: 'previsionsIndisponibles' }
  }
}

/**
 * Salariés actifs affectés au chantier, avec une adresse valable (une seule fois chacune, sans tenir compte de la
 * casse), rangés par adresse : un rejeu envoie le même lot, dans le même ordre.
 */
function destinataires(chantier: ChantierAlerte, membres: readonly MembreBtp[], equipes: readonly EquipeBtp[]): MembreBtp[] {
  const vues = new Set<string>()
  const adresse = (m: MembreBtp) => (m.email ?? '').trim().toLowerCase()
  const parAdresse = [...membres].sort((a, b) => adresse(a).localeCompare(adresse(b)) || a.id.localeCompare(b.id))
  return parAdresse.filter(m => {
    const email = (m.email ?? '').trim().toLowerCase()
    if (m.actif === false || !FORME_EMAIL.test(email) || vues.has(email)) return false
    if (!estAffecte(m, chantier, equipes)) return false
    vues.add(email)
    return true
  })
}

/** Un e-mail de l'alerte pour un salarié, dans la langue de la société. */
function messageAlerte(m: MembreBtp, fiche: Fiche, titre: string, corps: string): { to: string; subject: string; html: string } {
  const textes = fiche.isPt
    ? { anonyme: 'colaborador', bouton: 'Ver a meteorologia', langue: 'pt' as const }
    : { anonyme: 'collaborateur', bouton: 'Voir la météo', langue: 'fr' as const }
  const { subject, html } = templateGenericNotif({
    recipientName: [m.prenom, m.nom].filter(Boolean).join(' ') || textes.anonyme,
    title: titre,
    body: corps,
    ctaLabel: textes.bouton,
    ctaUrl: `https://vitfix.io/${textes.langue}/pro/dashboard/?p=meteo`,
    cabinetName: fiche.nom,
    locale: textes.langue,
  })
  return { to: (m.email ?? '').trim(), subject, html }
}

/** Résultat d'un lot dans le bilan ; une panne passagère (réseau, débit) fait rejouer l'appel. */
function compterLot(lot: ResultatLotEmailDetaille, nombre: number, chantierId: string, p: Passage): void {
  if (lot.ok) {
    p.bilan.emails += lot.acceptes.length
    p.bilan.refuses += lot.refuses.length
    return
  }
  if (lot.code === 'rejeu_refuse') {
    // Cette clé (jour + chantier) n'est donnée que par ce travail : le lot est parti au premier appel.
    p.bilan.dejaTraites++
    logger.warn('[cron/alerte-meteo] lot déjà traité aujourd’hui, avec un autre texte', { chantier: chantierId, code: lot.code })
    return
  }
  p.bilan.refuses += nombre
  p.bilan.lotsEnEchec++
  if (lot.code === 'reseau' || lot.code === 'limite' || lot.code === 'rejeu_concurrent') p.rejouer = true
  logger.warn('[cron/alerte-meteo] lot non envoyé', { chantier: chantierId, code: lot.code, motif: lot.motif })
}

async function traiterChantier(chantier: ChantierAlerte, fiche: Fiche, salaries: readonly MembreBtp[], p: Passage): Promise<void> {
  const prevision = await previsionDuChantier(chantier, p.dep)
  if (prevision.etat !== 'lue') {
    p.bilan[prevision.etat]++
    return
  }
  if (!chantierSuiviLe(chantier, prevision.demain)) return
  const alerte = alerteDuJour(prevision.jours, prevision.demain)
  if (!alerte) return
  p.bilan.alertes++
  const { titre, corps } = texteAlerteDuLendemain(chantier.titre ?? '', alerte.motifs, fiche.isPt, alerte.date)
  const messages = salaries.map(m => messageAlerte(m, fiche, titre, corps))
  if (p.lots > 0) await p.dep.attendre(PAUSE_ENTRE_LOTS_MS)
  p.lots++
  const lot = await sendBatchEmailsDetaille(messages, { idempotencyKey: `alerte-meteo-${alerte.date}-${chantier.id}` })
  compterLot(lot, messages.length, chantier.id, p)
}

async function traiterSociete(societeId: string, fiche: Fiche, p: Passage): Promise<void> {
  const { chantiers, membres, equipes } = await lireSociete(societeId)
  for (const chantier of chantiers) {
    if (!candidatDeDemain(chantier, p.dep.maintenantMs)) continue
    const salaries = destinataires(chantier, membres, equipes)
    if (salaries.length === 0) { p.bilan.sansDestinataire++; continue }
    if (p.budget <= 0) { p.bilan.nonTraites++; continue }
    if (p.dep.horloge() >= p.finMs) { p.bilan.nonTraites++; p.rejouer = true; continue }
    p.budget--
    p.bilan.chantiers++
    await traiterChantier(chantier, fiche, salaries, p)
  }
}

/** Envoie les e-mails de la veille pour toutes les sociétés concernées. Lève si la lecture de départ échoue. */
export async function envoyerAlertesDeLaVeille(dep: DependancesAlerteMeteo): Promise<ResultatAlerteMeteo> {
  const bilan = bilanVide()
  const lecture = await societesConcernees()
  if (lecture === 'colonne_absente') {
    logger.warn('[cron/alerte-meteo] chantiers_btp.alerte_meteo absente : migration 20261126b à appliquer')
    return { bilan: { ...bilan, raison: 'colonne_absente' }, rejouer: false }
  }
  bilan.societesCoupees = lecture.coupee
  const fiches = await fichesDesSocietes(lecture.ids)
  const p: Passage = { bilan, dep, lots: 0, budget: CHANTIERS_PAR_APPEL, finMs: dep.horloge() + DUREE_PASSAGE_MAX_MS, rejouer: false }
  for (const societeId of lecture.ids) {
    bilan.societes++
    const fiche = fiches.get(societeId) ?? { nom: 'Vitfix', isPt: false }
    try {
      await traiterSociete(societeId, fiche, p)
    } catch (err) {
      p.rejouer = true
      logger.error('[cron/alerte-meteo] société non traitée', { societe: societeId }, err)
    }
  }
  if (bilan.nonTraites > 0) logger.warn('[cron/alerte-meteo] limite de chantiers atteinte', { nonTraites: bilan.nonTraites })
  // Une prévision demandée sans réponse : le second appel retente ces chantiers, sans renvoyer les lots déjà partis.
  if (bilan.previsionsIndisponibles > 0) p.rejouer = true
  return { bilan, rejouer: p.rejouer }
}
