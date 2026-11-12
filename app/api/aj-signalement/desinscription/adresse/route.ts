// app/api/aj-signalement/desinscription/adresse/route.ts
//
// POST (D-P4, PUBLIQUE, cahier PR 3 § 4.1, § 7.5, § 8.1, § 8.2) — repli d'un lien expiré : « indiquez l'adresse e-mail à
// laquelle vous receviez ces informations ». Signature valable EXIGÉE (clé courante ou précédente, jeton de page ou un
// clic), lien expiré ou non ; jamais une adresse seule (aucune énumération). Puis signalements_qr_diffusion_opposer(…,
// 'lien_expire', adresse saisie) : la MÊME requête s'exécute que l'adresse soit juste ou fausse, la base seule normalise
// et compare à l'empreinte (une adresse fausse n'écrit rien). Réponse TOUJOURS { ok: true }, après la même durée
// minimale (400 ms) : adresse juste, fausse, lien purgé, autre cabinet ou signature fausse (sans aucun appel à la base)
// ne se distinguent ni par le corps ni par le temps. Limite atteinte → 429 traduit par la page, jamais un faux 200 ;
// erreur de la base → 503. 5 par 10 minutes et par IP, 5 par 24 h et par lien. L'adresse n'entre ni dans une clé de
// limite ni dans le journal du serveur. Jamais en cache.

import { type NextRequest, type NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { adresseDesinscriptionQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { journaliserRepliDiffusionQr, structureAbsenteQr } from '@/lib/aj-signalement/serveur'
import {
  DUREE_MIN_ADRESSE_DESINSCRIPTION_MS, attendreDureeMinimaleQr, erreurDesinscriptionQr, invalideDesinscriptionQr,
  limiteDesinscriptionQr, lireLienDesinscriptionQr, reponseDesinscriptionQr,
} from '@/lib/aj-signalement/serveur-desinscription'

const UN_JOUR_MS = 24 * 60 * 60 * 1000

/** Corps unique de toute issue « traitée » (adresse juste ou fausse, lien inconnu). */
const corpsTraite = () => reponseDesinscriptionQr({ ok: true })

async function traiter(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`qr_desinscription_adresse_ip_${ip}`, 5, 10 * 60_000))) return limiteDesinscriptionQr()
  const body: unknown = await request.json().catch(() => null)
  const validation = validateBody(adresseDesinscriptionQrSchema, body)
  if (!validation.success) return invalideDesinscriptionQr(validation.error)
  const { jeton, identifiant, email } = validation.data

  const lien = await lireLienDesinscriptionQr(jeton, identifiant, ['page', 'un_clic'])
  if (lien.etat === 'erreur') return erreurDesinscriptionQr('serveur', 503)
  // Signature fausse (aucun appel à la base), autre cabinet, diffusion purgée : même réponse qu'une adresse fausse.
  if (lien.etat === 'inconnu' || lien.etat === 'ancien') return corpsTraite()
  if (!(await checkRateLimit(`qr_desinscription_adresse_${lien.destinataireId}`, 5, UN_JOUR_MS))) return limiteDesinscriptionQr()

  const { error } = await supabaseAdmin.rpc('signalements_qr_diffusion_opposer', {
    p_destinataire: lien.destinataireId, p_origine: 'lien_expire', p_email_saisi: email,
  })
  if (error) {
    if (structureAbsenteQr(error)) {
      journaliserRepliDiffusionQr('opposition par l’adresse saisie', error)
      return corpsTraite()
    }
    logger.error('[AJ SIGNALEMENT] opposition par l’adresse saisie refusée par la base', { code: error.code })
    return erreurDesinscriptionQr('serveur', 503)
  }
  return corpsTraite()
}

export async function POST(request: NextRequest) {
  const debut = Date.now()
  let reponse: NextResponse
  try {
    reponse = await traiter(request)
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] opposition par l’adresse saisie', { message: e instanceof Error ? e.name : 'inconnue' })
    reponse = erreurDesinscriptionQr('serveur', 503)
  }
  // Même durée minimale pour toute réponse : ni le corps ni le temps ne disent si l'adresse était la bonne.
  await attendreDureeMinimaleQr(debut, DUREE_MIN_ADRESSE_DESINSCRIPTION_MS)
  return reponse
}
