// app/api/aj-signalement/gestionnaires/[id]/acces/route.ts
//
// POST (P2-R1, PR 2) — ouvrir l'accès d'un gestionnaire à l'espace de son cabinet (super admin) : un lien signé part
// par e-mail à la seule adresse de la fiche (vitfix.io/<identifiant>/invitation/#<jeton>, jeton après le « # ») ; le
// gestionnaire y choisit son mot de passe et crée son compte professionnel. Fiche active, hors adresses de
// l'administrateur (409 adresse_reservee), non contestée (409 adresse_contestee), sans compte relié (409 deja_ouvert :
// « Mot de passe oublié »). Un nouvel envoi rend les précédents caducs. Le lien n'est jamais rendu. Sans corps.
// Limites : 20 par minute et par IP, 20 par heure et par compte, 3 par heure et par fiche. Sans la migration 20261112 :
// 503 base_absente (« migration à appliquer »).

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { controlerAccesQr, estUuid, reponseErreur, reponseInvalide } from '@/lib/aj-signalement/serveur'
import { lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'
import { envoyerAccesFicheQr, lireCorpsVideQr, reponseBaseAccesQr } from '@/lib/aj-signalement/serveur-acces'

const CONTEXTE = '[AJ SIGNALEMENT]'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_acces_envoi_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_acces_envoi_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const corps = await lireCorpsVideQr(request)
    if (!corps.ok) return reponseInvalide(corps.details)
    if (!(await checkRateLimit(`qr_acces_fiche_${id}`, 3, 3_600_000))) return rateLimitResponse()

    const lue = await lireFicheQr(id)
    if (!lue.ok) return reponseBaseAccesQr(lue.erreur, 'envoi d’un accès : fiche', { gestionnaire: id })
    if (!lue.valeur) return reponseErreur('introuvable', 404)

    const resultat = await envoyerAccesFicheQr(lue.valeur, controle.user.id)
    if (!resultat.ok) return reponseErreur(resultat.code, resultat.status)
    return NextResponse.json({ emailEnvoye: resultat.emailEnvoye })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} envoi d’un accès`, { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseErreur('serveur', 500)
  }
}
