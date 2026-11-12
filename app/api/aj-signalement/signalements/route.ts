// app/api/aj-signalement/signalements/route.ts
//
// POST — dépôt public d'un signalement après scan du QR code d'une copropriété (AJ Signalement).
// Sans session : la copropriété est désignée par son jeton (32 hexadécimaux, tiré par la base) ; le corps
// est validé par signalementQrSchema (tous les champs obligatoires : prénom, nom, téléphone, e-mail, bâtiment,
// étage, numéro de lot, qualité propriétaire / locataire). Le signalement est enregistré dans signalements_qr
// puis envoyé par e-mail aux destinataires de la copropriété (sinon ADMIN_EMAIL), puis un récapitulatif part
// au déclarant, dans la langue de la page (au plus 3 par heure vers une même boîte). L'échec d'un e-mail
// n'annule jamais le dépôt : l'état des deux envois est conservé sur la ligne (un seul update final).
// Demandes de Hugo du 06/11/2026, enregistrées avec le dépôt :
//   - qualite_declarant ;
//   - adresse_proposee : adresse d'après la position du déclarant (texte seul), gardée seulement si la
//     copropriété n'a pas d'adresse ;
//   - signalement_lie_id : signalement désigné comme « le même problème », retrouvé par son numéro parmi les
//     signalements semblables de la copropriété du jeton (parties communes, ouverts, moins de 60 jours, même
//     bâtiment et même zone) ; un numéro introuvable est ignoré, le dépôt reste acquis.
// Limites : 5 dépôts par minute et par adresse IP, 30 par 10 minutes et par copropriété (QR code public).
// Codes : 400 invalide · 404 introuvable (jeton inconnu ou désactivé) · 429 · 503 base_absente (migration
// 20261104 non appliquée) · 500 serveur. Aucun lien avec les tables du logiciel Syndic.
// Migrations 20261106_signalements_qr_confirmation.sql puis 20261106_signalements_qr_geoloc_qualite.sql : appliquées
// en production le 11/11/2026 ; sans elles, insertion et état des e-mails se replient sur les colonnes d'origine
// (lib/aj-signalement/serveur.ts).
// Depuis le 11/11/2026 (P1-R20 ; demande de Hugo : le gestionnaire reçoit AUTOMATIQUEMENT les signalements de ses
// copropriétés) :
//   - destinataires = (adresses saisies MOINS celles de fiches inactives ou contestées) ∪ gestionnaires confirmés de la
//     copropriété (signalements_qr_emails_gestionnaires) ; ADMIN_EMAIL seulement si l'union est vide ;
//   - UN e-mail par destinataire (personne ne voit les autres adresses), repli un par un si le service refuse le lot ;
//     email_erreur résumé, jamais l'adresse ni le texte du service ;
//   - budget d'e-mails (60 / h par copropriété, 300 / h par cabinet), réservé en base AVANT l'envoi : au-delà, le dépôt
//     reste ENREGISTRÉ (réponse inchangée), l'e-mail est retenu, le super admin alerté une fois ; le prochain e-mail
//     parti mentionne les signalements retenus. Les limites du dépôt ne changent pas ;
//   - migration du 11/11/2026 absente : envoi aux adresses saisies, sans budget, comme avant (journalisé une fois).

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { signalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { CHEMIN_TABLEAU_QR, numeroSignalementQr, type SignalementQr } from '@/lib/aj-signalement/types'
import {
  coproprieteActiveQr, corrigerEmailsEnvoyesQr, enregistrerEtatEmailsQr, insererSignalementQr, lireGestionnairesDestinatairesQr, lireSemblablesQr,
  reponseErreurBase, reponseErreur, reserverEmailsQr, signalementDepuisLigne, type LigneCoproprieteQr,
} from '@/lib/aj-signalement/serveur'
import { destinatairesSignalementQr } from '@/lib/aj-signalement/destinataires'
import {
  ALERTE_LIMITE_ENVOI_QR, ERREUR_LIMITE_ENVOI_QR, alerteBudgetEmailsQr, mentionSignalementsRetenusQr,
} from '@/lib/aj-signalement/budget-emails'
import {
  FENETRE_CONFIRMATIONS_MS, LIMITE_CONFIRMATIONS_PAR_ADRESSE, cleLimiteConfirmationQr, envoyerAlerteAdministrateurQr, envoyerConfirmationQr,
  envoyerEmailsSignalementQr, masquerEmailsQr, resumeErreurEnvoiQr,
} from '@/lib/aj-signalement/email'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Erreur conservée (et montrée au super admin) quand la limite par adresse bloque la confirmation. */
const ERREUR_LIMITE_CONFIRMATION = `limite atteinte : ${LIMITE_CONFIRMATIONS_PAR_ADRESSE} confirmations par heure au plus vers cette boîte (variantes « + » comprises)`

/**
 * Récapitulatif au déclarant, après l'enregistrement. Ne lève jamais : un refus de Resend, la limite par adresse ou
 * une exception donnent { envoyeeLe: null, erreur }. La limite compte par boîte (variantes « + » et points Gmail
 * comprises, voir boiteCanoniqueConfirmationQr). L'adresse n'est pas dans la clé du limiteur (empreinte SHA-256) et
 * la route la masque dans ce qu'elle écrit au logger, si le message d'erreur de Resend la cite ; la ligne garde
 * l'erreur brute. Limite connue : en cas d'échec, sendEmail (lib/email.ts, commun à tous les e-mails) écrit lui-même
 * l'erreur brute de Resend dans la console, donc dans les journaux Workers, adresse comprise si Resend la cite.
 */
async function confirmerAuDeclarant(signalement: SignalementQr, nomCopropriete: string): Promise<{ envoyeeLe: string | null; erreur: string | null }> {
  try {
    const cle = await cleLimiteConfirmationQr(signalement.email)
    if (!(await checkRateLimit(cle, LIMITE_CONFIRMATIONS_PAR_ADRESSE, FENETRE_CONFIRMATIONS_MS))) {
      logger.warn(`${CONTEXTE} confirmation non envoyée : limite par adresse atteinte`, { signalement: signalement.id })
      return { envoyeeLe: null, erreur: ERREUR_LIMITE_CONFIRMATION }
    }
    const envoi = await envoyerConfirmationQr({ signalement, copropriete: { nom: nomCopropriete } })
    if (envoi.success) return { envoyeeLe: new Date().toISOString(), erreur: null }
    const erreur = (envoi.error || 'envoi impossible').slice(0, 500)
    logger.error(`${CONTEXTE} confirmation au déclarant non envoyée`, { erreur: masquerEmailsQr(erreur), signalement: signalement.id })
    return { envoyeeLe: null, erreur }
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} confirmation au déclarant`, { message: masquerEmailsQr(e instanceof Error ? e.message : String(e)), signalement: signalement.id })
    return { envoyeeLe: null, erreur: 'erreur interne lors de l’envoi' }
  }
}

/**
 * Signalement désigné comme « le même problème » : jamais un identifiant venu du public. Le numéro est cherché parmi
 * les signalements semblables de la copropriété du jeton (parties communes, ouverts, moins de 60 jours, même bâtiment,
 * même zone) ; introuvable → null, le dépôt continue.
 */
async function resoudreSignalementLie(
  coproprieteId: string, saisie: { estPartieCommune: boolean; signalementLieNumero: string; batiment: string; zoneSignalee: string },
): Promise<string | null> {
  if (!saisie.estPartieCommune || !saisie.signalementLieNumero) return null
  const lecture = await lireSemblablesQr(coproprieteId, { batiment: saisie.batiment, zone: saisie.zoneSignalee })
  if (!lecture.ok) return null
  const lie = lecture.lignes.find((l) => numeroSignalementQr(l.id) === saisie.signalementLieNumero)
  if (!lie) logger.info(`${CONTEXTE} lien ignoré : aucun signalement ouvert semblable ne porte ce numéro`, { copropriete: coproprieteId })
  return lie?.id ?? null
}

/**
 * Un e-mail par destinataire, sous budget (RG-06 ter) ; ne lève jamais. Rend l'état à enregistrer : envoyé dès qu'un
 * message est parti ; erreur résumée (nombres seulement) ou limite d'envoi atteinte.
 */
async function envoyerAuxDestinataires(
  copropriete: LigneCoproprieteQr, signalement: SignalementQr,
): Promise<{ emailEnvoyeLe: string | null; emailErreur: string | null }> {
  const lignes = await lireGestionnairesDestinatairesQr(copropriete.id)
  const { destinataires, auDelaDuPlafond } = destinatairesSignalementQr(copropriete, lignes)
  if (auDelaDuPlafond > 0) logger.warn(`${CONTEXTE} destinataires au-delà du plafond : non envoyés`, { copropriete: copropriete.id, nombre: auDelaDuPlafond })
  if (destinataires.length === 0) {
    logger.error(`${CONTEXTE} aucun destinataire : ni e-mails de la copropriété, ni gestionnaire, ni ADMIN_EMAIL`, { copropriete: copropriete.id })
    return { emailEnvoyeLe: null, emailErreur: 'aucun destinataire configuré' }
  }
  const origine = process.env.NEXT_PUBLIC_APP_URL || undefined
  // Budget réservé en base AVANT l'envoi ; null : migration absente ou erreur (envoi sans budget, comme avant).
  const reservation = await reserverEmailsQr(signalement.id, destinataires.length)
  if (reservation && !reservation.accorde) {
    logger.warn(`${CONTEXTE} limite d’envoi atteinte : e-mail retenu, dépôt enregistré`, { copropriete: copropriete.id, signalement: signalement.id })
    if (alerteBudgetEmailsQr(reservation)) {
      const lien = `${(origine ?? 'https://vitfix.io').replace(/\/+$/, '')}${CHEMIN_TABLEAU_QR}`
      const alerte = await envoyerAlerteAdministrateurQr({ objet: ALERTE_LIMITE_ENVOI_QR.objet, texte: ALERTE_LIMITE_ENVOI_QR.texte, lien })
      if (alerte.refuses > 0) logger.warn(`${CONTEXTE} alerte de limite d’envoi non envoyée`, { refuses: alerte.refuses, total: alerte.total })
    }
    return { emailEnvoyeLe: null, emailErreur: ERREUR_LIMITE_ENVOI_QR }
  }
  const bilan = await envoyerEmailsSignalementQr({
    destinataires, signalement, copropriete: { nom: copropriete.nom ?? '', adresse: copropriete.adresse ?? '' },
    origine, mention: reservation ? mentionSignalementsRetenusQr(reservation.retenus) : null,
  })
  if (reservation && bilan.envoyes < destinataires.length) await corrigerEmailsEnvoyesQr(signalement.id, bilan.envoyes)
  const emailErreur = resumeErreurEnvoiQr(bilan)
  if (emailErreur) logger.error(`${CONTEXTE} e-mails refusés par le service`, { signalement: signalement.id, refuses: bilan.refuses, total: bilan.total })
  return { emailEnvoyeLe: bilan.envoyes > 0 ? new Date().toISOString() : null, emailErreur }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalement_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(signalementQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const saisie = validation.data

    const active = await coproprieteActiveQr(saisie.jeton)
    if (!active.ok) return active.reponse
    const copropriete = active.copropriete
    if (!(await checkRateLimit(`qr_signalement_copro_${copropriete.id}`, 30, 600_000))) return rateLimitResponse()

    const ligne = {
      copropriete_id: copropriete.id,
      prenom: saisie.prenom,
      nom: saisie.nom,
      telephone: saisie.telephone,
      // En minuscules : c'est l'adresse de réponse de l'e-mail et une clé de recherche possible.
      email: saisie.email.trim().toLowerCase(),
      batiment: saisie.batiment,
      etage: saisie.etage,
      num_lot: saisie.numLot,
      est_partie_commune: saisie.estPartieCommune,
      zone_signalee: saisie.estPartieCommune ? saisie.zoneSignalee : '',
      type_intervention: saisie.typeIntervention,
      description: saisie.description,
      priorite: saisie.priorite,
      statut: 'en_attente',
      langue: saisie.langue,
      qualite_declarant: saisie.qualiteDeclarant,
      // Adresse déjà renseignée (même entre-temps) : la proposition est ignorée.
      adresse_proposee: (copropriete.adresse ?? '').trim() ? null : saisie.adresseProposee || null,
      signalement_lie_id: await resoudreSignalementLie(copropriete.id, saisie),
    }
    const { data, error } = await insererSignalementQr(ligne)
    if (error || !data) {
      logger.error(`${CONTEXTE} insertion refusée`, { code: error?.code, message: error?.message, copropriete: copropriete.id })
      return reponseErreurBase(error)
    }
    const signalement = signalementDepuisLigne(
      {
        ...ligne, id: data.id, email_envoye_le: null, email_erreur: null, confirmation_envoyee_le: null, confirmation_erreur: null,
        created_at: data.created_at, updated_at: data.updated_at ?? data.created_at,
      },
      copropriete.nom ?? '',
    )

    // E-mails aux destinataires : l'échec n'annule pas le dépôt (le tableau de bord le montre, email_erreur le garde).
    const { emailEnvoyeLe, emailErreur } = await envoyerAuxDestinataires(copropriete, signalement)
    // Récapitulatif au déclarant, après l'e-mail de l'administrateur ; même règle : le dépôt reste acquis.
    const confirmation = await confirmerAuDeclarant(signalement, copropriete.nom ?? '')

    // Un seul update final des quatre états (réduit à email_* tant que la migration de la confirmation manque).
    await enregistrerEtatEmailsQr(data.id, {
      email_envoye_le: emailEnvoyeLe,
      email_erreur: emailErreur,
      confirmation_envoyee_le: confirmation.envoyeeLe,
      confirmation_erreur: confirmation.erreur,
    })

    return NextResponse.json({
      signalement: {
        id: data.id,
        numero: numeroSignalementQr(data.id),
        creeLe: data.created_at,
        emailEnvoye: emailEnvoyeLe !== null,
        confirmationEnvoyee: confirmation.envoyeeLe !== null,
      },
    })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} dépôt`, { message: e instanceof Error ? e.message : String(e) }, e)
    return reponseErreur('serveur', 500)
  }
}
