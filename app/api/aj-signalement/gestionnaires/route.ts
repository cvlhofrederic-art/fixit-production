// app/api/aj-signalement/gestionnaires/route.ts
//
// Fiches gestionnaires d'un cabinet client, tenues par le super admin (PR 1 : aucun compte, aucune connexion).
// GET (P1-R8) — liste : état calculé (confirmation envoyée / expirée, adresse confirmée / contestée, désactivée),
//   « domaine forcé », copropriétés attribuées, signalements ouverts et urgents de sa portée ; filtres etat et cabinet ;
//   jamais de jeton d'envoi ; jamais en cache.
// POST (P1-R9) — création, puis envoi du lien de confirmation d'adresse (demandes de Hugo du 10/11/2026 : le gestionnaire
//   reçoit les signalements de ses copropriétés une fois son adresse confirmée, et seulement sur un domaine e-mail de
//   SON cabinet). Dans cet ordre : adresse de l'administrateur → 409 adresse_reservee ; cabinet inconnu → 409
//   a_reverifier ; aucun domaine → 409 domaines_a_renseigner ; adresse déjà en table → 409 existe_deja { id } ;
//   domaine déclaré par un AUTRE cabinet client → 409 domaine_autre_cabinet, sans forçage possible ; domaine d'aucun
//   cabinet → 409 hors_domaine sauf forcerDomaine (fiche « domaine forcé », journalisée) ; lecture des domaines en
//   échec → 500 avant toute écriture ; puis
//   l'identifiant de la fiche est tiré ICI et signé dans le lien (nouvelleInvitation) AVANT toute écriture ; la
//   fonction SQL insère la fiche avec cet id, l'envoi, les attributions et le journal en une transaction ; enfin
//   l'e-mail part (lien /<identifiant>/confirmation-adresse/#<jeton>). Ni le lien ni le jeton ne sont renvoyés.
//   Contre-vérification du 12/11 (migration 20261112) : la fonction SQL refuse aussi une adresse qui partage une BOÎTE
//   avec une fiche existante, active ou non (même boîte sous une autre étiquette « + », ou même partie locale sur un
//   domaine de l'un des deux cabinets : la règle « adresse d'une fiche ») → 409 existe_deja { id }, l'identifiant de
//   cette fiche lu dans le DETAIL de l'erreur (rendu seulement s'il a la forme d'un uuid). Avant la 20261112 : l'adresse
//   exacte seule, comme en PR 1.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { gestionnaireQrSchema, listeGestionnairesQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { nouvelleInvitation } from '@/lib/equipe/lien-invitation'
import { emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import {
  TABLE_COPROPRIETES_QR, TABLE_GESTIONNAIRES_QR, controlerAccesQr, lireCabinetQr, lireDomainesAutresCabinetsQr, lireDomainesCabinetQr, parametresQr, reponseErreur,
  reponseErreurSqlQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import { envoyerLienConfirmationQr, gestionnairesDepuisFichesQr, lireFicheQr, lireFichesQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'
/** Identifiant d'une fiche (uuid) : seule forme rendue depuis le DETAIL d'une erreur existe_deja. */
const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_gestionnaires_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_gestionnaires_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const validation = validateBody(listeGestionnairesQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)
    const fiches = await lireFichesQr(validation.data)
    if (!fiches.ok) return reponseErreurSqlQr(fiches.erreur, 'lecture des gestionnaires')
    const liste = await gestionnairesDepuisFichesQr(fiches.valeur)
    if (!liste.ok) return reponseErreurSqlQr(liste.erreur, 'lecture des gestionnaires')
    return reponsePriveeQr({ gestionnaires: liste.valeur })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} liste des gestionnaires`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_gestionnaire_post_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_gestionnaire_post_${controle.user.id}`, 20, 3_600_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(gestionnaireQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const s = validation.data

    const reservees = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL_2].map(emailCanoniqueQr).filter(Boolean)
    if (reservees.includes(s.email)) return reponseErreur('adresse_reservee', 409)

    const cabinet = await lireCabinetQr({ id: s.cabinetId })
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet')
    if (!cabinet.cabinet) return reponseErreur('a_reverifier', 409)
    // Lecture des domaines en échec (délai dépassé…) : 500 sans rien écrire, jamais un contrôle sauté (relecture 4).
    const domaines = await lireDomainesCabinetQr(s.cabinetId)
    if (!domaines.ok) return reponseErreurSqlQr(domaines.erreur, 'lecture des domaines', { cabinet: s.cabinetId })
    if (domaines.valeur.length === 0) return reponseErreur('domaines_a_renseigner', 409)

    const existante = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id').eq('email', s.email).maybeSingle()
    if (existante.error) return reponseErreurSqlQr(existante.error, 'lecture des gestionnaires')
    const idExistant = (existante.data as { id?: unknown } | null)?.id
    if (typeof idExistant === 'string') return NextResponse.json({ error: 'existe_deja', id: idExistant }, { status: 409 })

    const dansDomaines = emailDansDomainesQr(s.email, domaines.valeur)
    if (!dansDomaines) {
      // Domaine déclaré par un AUTRE cabinet client : refusé sans forçage possible (§ 6, relecture 2).
      const autres = await lireDomainesAutresCabinetsQr(s.cabinetId, [s.email.split('@')[1] ?? ''])
      if (!autres.ok) return reponseErreurSqlQr(autres.erreur, 'lecture des domaines des autres cabinets', { cabinet: s.cabinetId })
      if (autres.valeur.length > 0) return reponseErreur('domaine_autre_cabinet', 409)
      if (!s.forcerDomaine) return reponseErreur('hors_domaine', 409)
    }

    // L'identifiant de la fiche existe AVANT la signature et est inséré tel quel (aucun DEFAULT en base).
    const gestionnaireId = globalThis.crypto.randomUUID()
    const invitation = await nouvelleInvitation('aj_signalement', s.email, gestionnaireId)
    const { error } = await supabaseAdmin.rpc('signalements_qr_inviter_gestionnaire', {
      p_gestionnaire: { id: gestionnaireId, cabinetId: s.cabinetId, nom: s.nom, email: s.email, domaineForce: !dansDomaines },
      p_invitation: { id: invitation.id, invite_token: invitation.invite_token, email: s.email },
      p_coproprietes: s.coproprieteIds,
      p_acteur: controle.user.id,
    })
    if (error?.code === 'P0001' && error.message === 'existe_deja') {
      // Boîte déjà portée par une fiche (20261112) : son identifiant est en DETAIL ; rien d'autre n'est rendu.
      const id = typeof error.details === 'string' && FORME_UUID.test(error.details) ? error.details : null
      return NextResponse.json(id ? { error: 'existe_deja', id } : { error: 'existe_deja' }, { status: 409 })
    }
    if (error) return reponseErreurSqlQr(error, 'création d’un gestionnaire')

    const cab = { id: s.cabinetId, nom: cabinet.cabinet.nom ?? '', identifiant: cabinet.cabinet.identifiant ?? '' }
    const emailEnvoye = await envoyerLienConfirmationQr({
      envoiId: invitation.id, jetonLien: invitation.jetonLien, email: s.email, nom: s.nom, gestionnaireId, cabinet: cab, acteurId: controle.user.id,
    })

    // RG-06 bis-5 : copropriétés dont les adresses saisies contiennent déjà cette adresse (à nettoyer à l'écran).
    const saisies = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, nom').contains('emails_destinataires', [s.email])
    if (saisies.error) logger.warn(`${CONTEXTE} copropriétés à adresse saisie non lues`, { code: saisies.error.code, gestionnaire: gestionnaireId })
    const coproprietesAvecAdresseSaisie = ((saisies.data ?? []) as Array<{ id: string; nom: string | null }>).map((c) => ({ id: c.id, nom: c.nom ?? '' }))

    const fiche = await lireFicheQr(gestionnaireId)
    if (!fiche.ok || !fiche.valeur) return reponseErreur('a_reverifier', 409)
    const forme = await gestionnairesDepuisFichesQr([fiche.valeur])
    if (!forme.ok) return reponseErreurSqlQr(forme.erreur, 'relecture du gestionnaire', { gestionnaire: gestionnaireId })
    return NextResponse.json({ gestionnaire: forme.valeur[0], emailEnvoye, coproprietesAvecAdresseSaisie }, { status: 201 })
  } catch (e: unknown) {
    // Ex. clé de signature absente : rien n'a été écrit (la signature est tirée avant l'appel de la fonction).
    logger.error(`${CONTEXTE} création d’un gestionnaire`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
