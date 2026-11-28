// app/api/aj-signalement/gestionnaires/acces/route.ts
//
// POST (P2-R1b, PR 2) — « Ouvrir l'accès aux gestionnaires (n) » (super admin) : P2-R1 pour chaque fiche demandée, une à
// une, dans l'ordre (ids en double ignorés) ; 1 à 50 fiches. Réponse { envoyes, echecs: [{ id, code }] } : codes de
// P2-R1 (adresse_reservee, adresse_contestee, deja_ouvert, a_reverifier…), introuvable, trop_de_demandes (3 envois par
// heure et par fiche), email_non_envoye (envoi enregistré, e-mail refusé par le service : à renvoyer). Jamais de lien.
// Limites : 20 par minute et par IP, 5 par heure et par compte. Sans la migration 20261112 : 503 base_absente.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { accesGroupeQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { TABLE_GESTIONNAIRES_QR, controlerAccesQr, reponseErreur, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { COLONNES_FICHE_QR, type LigneFicheQr } from '@/lib/aj-signalement/serveur-gestion'
import { envoyerAccesFicheQr, reponseBaseAccesQr } from '@/lib/aj-signalement/serveur-acces'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_acces_groupe_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_acces_groupe_${controle.user.id}`, 5, 3_600_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(accesGroupeQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const ids = [...new Set(validation.data.gestionnaireIds.map((id) => id.toLowerCase()))]

    const { data, error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_FICHE_QR).in('id', ids)
    if (error) return reponseBaseAccesQr(error, 'envoi groupé des accès : fiches')
    const fiches = new Map(((data ?? []) as LigneFicheQr[]).map((f) => [f.id, f]))

    let envoyes = 0
    const echecs: Array<{ id: string; code: string }> = []
    for (const id of ids) {
      const fiche = fiches.get(id)
      if (!fiche) {
        echecs.push({ id, code: 'introuvable' })
        continue
      }
      if (!(await checkRateLimit(`qr_acces_fiche_${id}`, 3, 3_600_000))) {
        echecs.push({ id, code: 'trop_de_demandes' })
        continue
      }
      const resultat = await envoyerAccesFicheQr(fiche, controle.user.id)
      // Migration absente : vraie pour toutes les fiches, on s'arrête là (rien n'a pu partir).
      if (!resultat.ok && resultat.code === 'base_absente') return reponseErreur('base_absente', 503)
      if (!resultat.ok) echecs.push({ id, code: resultat.code })
      else if (resultat.emailEnvoye) envoyes += 1
      else echecs.push({ id, code: 'email_non_envoye' })
    }
    return NextResponse.json({ envoyes, echecs })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} envoi groupé des accès`, { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
