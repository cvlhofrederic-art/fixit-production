// E-mail de la veille au soir de l'alerte météo (décision de Frédéric du 26/11/2026 : « soumettre un chantier à
// l'alerte météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il pleut »). Appelé chaque
// soir par la route app/api/cron/alerte-meteo, que déclenche le Cron Trigger du Worker (worker/taches-planifiees.ts).
//   - chantiers soumis à l'alerte (chantiers_btp.alerte_meteo, migration 20261126b) suivis demain : « En cours », ou
//     « En attente » dont demain est le premier jour (chantierSuiviLe, la règle du téléphone) ; colonne absente : rien ;
//   - prévision Open-Meteo du chantier, délai borné ; « demain » et l'heure sont ceux du chantier (décalage horaire de
//     la réponse) ; hors de la soirée du chantier (FENETRE_SOIR), rien n'est envoyé : un appel en retard ou lancé à la
//     main ne prévient pas en pleine nuit pour le mauvais jour ;
//   - destinataires : les salariés actifs affectés au chantier (directement ou par leur équipe) qui ont une adresse
//     e-mail, une fois chacune, qu'ils aient l'appli ou non (le serveur ne sait pas ce que le téléphone a programmé) ;
//     langue et nom de la fiche de la société ;
//   - un lot Resend par chantier, clé d'idempotence (jour + chantier), une seconde entre deux lots (débit commun à
//     tout Vitfix) ;
//   - au plus CHANTIERS_PAR_APPEL chantiers par appel : le reste est compté et journalisé, jamais passé sous silence ;
//   - `rejouer` : un lot en panne passagère, une société illisible, ou aucune prévision lue ; le second appel n'envoie
//     rien en double (même clé d'idempotence).
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
export const DELAI_PREVISION_MS = 8000
export const PAUSE_ENTRE_LOTS_MS = 1000
/** Soirée du chantier, en heures locales [début, fin) : l'e-mail ne part que dans cette plage. */
export const FENETRE_SOIR = { debut: 16, fin: 22 } as const

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
  /** Chantiers laissés de côté au-delà de CHANTIERS_PAR_APPEL. */
  nonTraites: number
  raison?: 'colonne_absente'
}

export interface ResultatAlerteMeteo {
  bilan: BilanAlerteMeteo
  /** Vrai s'il faut rejouer l'appel (sans risque de doublon) : la route répond alors 503. */
  rejouer: boolean
}

export interface DependancesAlerteMeteo {
  maintenantMs: number
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
  rejouer: boolean
}

const bilanVide = (): BilanAlerteMeteo => ({
  societes: 0, chantiers: 0, alertes: 0, emails: 0, refuses: 0, sansPosition: 0, previsionsIndisponibles: 0, horsFenetre: 0,
  nonTraites: 0,
})

/** Sociétés qui ont au moins un chantier soumis à l'alerte, en cours ou en attente ; colonne absente : la raison. */
async function societesConcernees(): Promise<string[] | 'colonne_absente'> {
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
  if (lignes.length >= LIGNES_SOCIETES_MAX) {
    logger.warn('[cron/alerte-meteo] liste des sociétés coupée : les suivantes ne sont pas traitées', { lignes: lignes.length })
  }
  return [...new Set(lignes.map(l => l.owner_id).filter((id): id is string => typeof id === 'string' && id !== ''))]
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
    supabaseAdmin.from('membres_btp').select('*').eq('owner_id', societeId).limit(500),
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

/** Prévision du chantier, et « demain » à l'heure du chantier ; hors de la soirée du chantier : rien à envoyer. */
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
    if (moment.heure < FENETRE_SOIR.debut || moment.heure >= FENETRE_SOIR.fin) return { etat: 'horsFenetre' }
    return { etat: 'lue', demain: moment.demain, jours: joursDePrevisions(corps) }
  } catch (err) {
    logger.warn('[cron/alerte-meteo] prévision illisible', { chantier: chantier.id, erreur: err instanceof Error ? err.name : typeof err })
    return { etat: 'previsionsIndisponibles' }
  }
}

/** Salariés actifs affectés au chantier, avec une adresse valable (une seule fois chacune, sans tenir compte de la casse). */
function destinataires(chantier: ChantierAlerte, membres: readonly MembreBtp[], equipes: readonly EquipeBtp[]): MembreBtp[] {
  const vues = new Set<string>()
  return membres.filter(m => {
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
  p.bilan.refuses += nombre
  if (lot.code === 'reseau' || lot.code === 'limite' || lot.code === 'rejeu_concurrent') p.rejouer = true
  logger.warn('[cron/alerte-meteo] lot non envoyé', { chantier: chantierId, code: lot.code, motif: lot.motif })
}

async function traiterChantier(
  chantier: ChantierAlerte, fiche: Fiche, membres: readonly MembreBtp[], equipes: readonly EquipeBtp[], p: Passage,
): Promise<void> {
  const prevision = await previsionDuChantier(chantier, p.dep)
  if (prevision.etat !== 'lue') {
    p.bilan[prevision.etat]++
    return
  }
  if (!chantierSuiviLe(chantier, prevision.demain)) return
  const alerte = alerteDuJour(prevision.jours, prevision.demain)
  if (!alerte) return
  p.bilan.alertes++
  const salaries = destinataires(chantier, membres, equipes)
  if (salaries.length === 0) return
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
    if (p.budget <= 0) { p.bilan.nonTraites++; continue }
    p.budget--
    p.bilan.chantiers++
    await traiterChantier(chantier, fiche, membres, equipes, p)
  }
}

/** Envoie les e-mails de la veille pour toutes les sociétés concernées. Lève si la lecture de départ échoue. */
export async function envoyerAlertesDeLaVeille(dep: DependancesAlerteMeteo): Promise<ResultatAlerteMeteo> {
  const bilan = bilanVide()
  const societes = await societesConcernees()
  if (societes === 'colonne_absente') {
    logger.warn('[cron/alerte-meteo] chantiers_btp.alerte_meteo absente : migration 20261126b à appliquer')
    return { bilan: { ...bilan, raison: 'colonne_absente' }, rejouer: false }
  }
  const fiches = await fichesDesSocietes(societes)
  const p: Passage = { bilan, dep, lots: 0, budget: CHANTIERS_PAR_APPEL, rejouer: false }
  for (const societeId of societes) {
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
  if (bilan.chantiers > 0 && bilan.previsionsIndisponibles === bilan.chantiers) p.rejouer = true
  return { bilan, rejouer: p.rejouer }
}
