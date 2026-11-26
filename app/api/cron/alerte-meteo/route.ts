// app/api/cron/alerte-meteo/route.ts
//
// GET — e-mail de secours de l'alerte météo (décision de Frédéric du 26/11/2026 : « soumettre un chantier à l'alerte
// météo par notif ou pas si cela le concerne, exemple on fait une dalle béton mais il pleut »). Appelé chaque jour en
// fin d'après-midi par GitHub Actions (.github/workflows/crons.yml, job alerte-meteo ; le Worker n'a pas de cron).
//   - en-tête « Authorization: Bearer CRON_SECRET » comparé à temps constant (empreintes SHA-256) ; secret absent côté
//     serveur, en-tête absent ou faux → 401 ;
//   - chantiers EN COURS soumis à l'alerte (chantiers_btp.alerte_meteo, migration 20261126b) ; colonne absente → 200
//     sans envoi (base pas encore migrée) ;
//   - prévision du lendemain (Open-Meteo, mêmes seuils que l'écran Météo, lib/btp/alerte-meteo.ts) ; sans alerte,
//     rien n'est envoyé ;
//   - destinataires : les salariés actifs affectés au chantier (employés du chantier ou de son équipe, comme le
//     pointage, lib/btp/pointage-regles.ts) qui ont une adresse e-mail ; langue de la fiche de la société ;
//   - un lot Resend par chantier, avec une clé d'idempotence (jour + chantier) : un second appel le même jour
//     n'envoie rien de plus.
// La notification sur le téléphone est programmée par l'appli elle-même (lib/btp/alerte-meteo-telephone.ts) : ce
// courriel prévient celui qui ne l'a pas ouverte. Journal : identifiants et nombres seulement, jamais d'adresse.

import { NextResponse, type NextRequest } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { sendBatchEmailsDetaille, templateGenericNotif } from '@/lib/email'
import { urlPrevisionsMeteo } from '@/lib/btp/meteo-url'
import { alerteDuLendemain, joursDePrevisions, texteAlerteDuLendemain } from '@/lib/btp/alerte-meteo'
import { lireDonneesSociete } from '@/lib/btp/pointage-serveur'
import { chantiersAffectes, type ChantierBtp, type EquipeBtp, type MembreBtp } from '@/lib/btp/pointage-regles'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Au plus autant de chantiers par appel (durée d'une requête du Worker ; un appel Open-Meteo par chantier). */
export const CHANTIERS_PAR_APPEL = 100

const COLONNE_ABSENTE = new Set(['42703', 'PGRST204'])
const FORME_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest()

/** Secret configuré ET en-tête égal, comparés à temps constant sur des empreintes de même longueur. */
function autorise(entete: string | null): boolean {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret === '' || !entete) return false
  return timingSafeEqual(empreinte(entete), empreinte(`Bearer ${secret}`))
}

interface ChantierAlerte extends ChantierBtp {
  owner_id: string
  alerte_meteo?: boolean | null
}

interface Bilan {
  chantiers: number
  alertes: number
  emails: number
  refuses: number
  ignores: number
}

/** Prévision du lendemain d'un chantier ; null si sa position manque ou si le service ne répond pas. */
async function alerteDuChantier(chantier: ChantierBtp) {
  const url = urlPrevisionsMeteo(chantier.latitude, chantier.longitude)
  if (!url) return null
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) return null
    return alerteDuLendemain(joursDePrevisions(await reponse.json()))
  } catch (err) {
    logger.warn('[cron/alerte-meteo] prévision illisible', { chantier: chantier.id, erreur: err instanceof Error ? err.name : typeof err })
    return null
  }
}

/** Salariés actifs affectés au chantier, avec une adresse valable (une seule fois chacune). */
function destinataires(chantier: ChantierBtp, membres: readonly MembreBtp[], equipes: readonly EquipeBtp[]): MembreBtp[] {
  const vues = new Set<string>()
  return membres.filter(m => {
    const email = (m.email ?? '').trim().toLowerCase()
    if (m.actif === false || !FORME_EMAIL.test(email) || vues.has(email)) return false
    if (chantiersAffectes(m, [chantier], equipes).length === 0) return false
    vues.add(email)
    return true
  })
}

async function fichesDesSocietes(ids: readonly string[]): Promise<Map<string, { nom: string; isPt: boolean }>> {
  const fiches = new Map<string, { nom: string; isPt: boolean }>()
  if (ids.length === 0) return fiches
  const { data, error } = await supabaseAdmin.from('profiles_artisan').select('user_id, company_name, language').in('user_id', [...ids])
  if (error) logger.warn('[cron/alerte-meteo] fiches des sociétés illisibles', { code: error.code })
  for (const f of (data ?? []) as Array<{ user_id: string; company_name?: string | null; language?: string | null }>) {
    if (!fiches.has(f.user_id)) fiches.set(f.user_id, { nom: f.company_name?.trim() || 'Vitfix', isPt: f.language === 'pt' })
  }
  return fiches
}

async function traiterSociete(societeId: string, fiche: { nom: string; isPt: boolean }, bilan: Bilan): Promise<void> {
  const donnees = await lireDonneesSociete(societeId)
  const soumis = (donnees.chantiersEnCours as ChantierAlerte[]).filter(c => c.alerte_meteo === true)
  for (const chantier of soumis) {
    bilan.chantiers++
    const alerte = await alerteDuChantier(chantier)
    if (!alerte) { bilan.ignores++; continue }
    bilan.alertes++
    const salaries = destinataires(chantier, donnees.membres, donnees.equipes)
    if (salaries.length === 0) continue
    const { titre, corps } = texteAlerteDuLendemain(chantier.titre ?? '', alerte.motifs, fiche.isPt)
    const messages = salaries.map(m => {
      const { subject, html } = templateGenericNotif({
        recipientName: [m.prenom, m.nom].filter(Boolean).join(' ') || (fiche.isPt ? 'colaborador' : 'collaborateur'),
        title: titre,
        body: corps,
        ctaLabel: fiche.isPt ? 'Ver a meteorologia' : 'Voir la météo',
        ctaUrl: `https://vitfix.io/${fiche.isPt ? 'pt' : 'fr'}/pro/dashboard/?p=meteo`,
        cabinetName: fiche.nom,
        locale: fiche.isPt ? 'pt' : 'fr',
      })
      return { to: (m.email ?? '').trim(), subject, html }
    })
    const lot = await sendBatchEmailsDetaille(messages, { idempotencyKey: `alerte-meteo-${alerte.date}-${chantier.id}` })
    if (lot.ok) {
      bilan.emails += lot.acceptes.length
      bilan.refuses += lot.refuses.length
    } else {
      bilan.refuses += messages.length
      logger.warn('[cron/alerte-meteo] lot non envoyé', { chantier: chantier.id, motif: lot.motif })
    }
  }
}

export async function GET(request: NextRequest) {
  if (!autorise(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const bilan: Bilan = { chantiers: 0, alertes: 0, emails: 0, refuses: 0, ignores: 0 }
  try {
    const { data, error } = await supabaseAdmin
      .from('chantiers_btp')
      .select('owner_id')
      .eq('alerte_meteo', true)
      .eq('statut', 'En cours')
      .limit(CHANTIERS_PAR_APPEL)
    if (error) {
      if (COLONNE_ABSENTE.has(String(error.code))) {
        logger.warn('[cron/alerte-meteo] chantiers_btp.alerte_meteo absente : migration 20261126b à appliquer')
        return NextResponse.json({ ...bilan, raison: 'colonne_absente' })
      }
      throw new Error(`lecture des chantiers : ${error.code}`)
    }
    const societes = [...new Set(((data ?? []) as Array<{ owner_id: string }>).map(l => l.owner_id).filter(Boolean))]
    const fiches = await fichesDesSocietes(societes)
    for (const societeId of societes) {
      try {
        await traiterSociete(societeId, fiches.get(societeId) ?? { nom: 'Vitfix', isPt: false }, bilan)
      } catch (err) {
        logger.error('[cron/alerte-meteo] société non traitée', { societe: societeId, erreur: err instanceof Error ? err.message : String(err) })
      }
    }
    logger.info('[cron/alerte-meteo] terminé', { ...bilan })
    return NextResponse.json(bilan)
  } catch (err) {
    logger.error('[cron/alerte-meteo] échec', { erreur: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
