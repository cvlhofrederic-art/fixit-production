// app/api/vitfixsignal/signalements/route.ts
//
// POST — dépôt public d'un signalement après scan du QR code d'une copropriété (Vitfix Signal).
// Sans session : la copropriété est désignée par son jeton (32 hexadécimaux, tiré par la base) ; le corps
// est validé par signalementQrSchema (tous les champs obligatoires : prénom, nom, téléphone, e-mail, bâtiment,
// étage, numéro de lot, qualité propriétaire / locataire). Le signalement est enregistré dans signalements_qr
// puis envoyé par e-mail aux destinataires de la copropriété (sans destinataire : D9 ci-dessous), puis un récapitulatif part
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
// Codes : 400 invalide · 400 batiment_inconnu (voir plus bas) · 404 introuvable (jeton inconnu ou désactivé) · 429 ·
// 503 base_absente (migration 20261104 non appliquée) · 500 serveur. Aucun lien avec les tables du logiciel Syndic.
// Migrations 20261106_signalements_qr_confirmation.sql puis 20261106_signalements_qr_geoloc_qualite.sql : appliquées
// en production le 11/11/2026 ; sans elles, insertion et état des e-mails se replient sur les colonnes d'origine
// (lib/vitfixsignal/serveur.ts).
// Depuis le 11/11/2026 (P1-R20 ; demande de Hugo : le gestionnaire reçoit AUTOMATIQUEMENT les signalements de ses
// copropriétés) :
//   - destinataires = (adresses saisies MOINS celles de fiches inactives ou contestées) ∪ gestionnaires confirmés de la
//     copropriété (signalements_qr_emails_gestionnaires) ;
//   - D9 (décision de Hugo du 17/11/2026, au nom de VitFix, point 7) : union vide → repli vers les boîtes de VitFix
//     (ADMIN_EMAIL) COUPÉ ; le signalement part à l'adresse de contact du cabinet de la copropriété (seule adresse du
//     cabinet que le code connaît), pour qu'il ne reste jamais sans lecteur ; VitFix reçoit une alerte SANS AUCUNE DONNÉE
//     (« un signalement attend un destinataire », son numéro et son identifiant technique), qui dit qui l'a reçu. Sans
//     adresse de contact, ou pour une copropriété rattachée à aucun cabinet (relecture du 17/11/2026 : le code ne la
//     distingue pas d'une copropriété du cabinet client pas encore rattachée), personne ne le reçoit par e-mail : l'alerte
//     le dit, le signalement reste lisible dans l'espace Vitfix Signal. Le cabinet et son adresse ne sont lus que dans ce
//     cas. L'alerte part au plus une fois par heure, par copropriété et par situation, et jamais quand la limite d'envoi
//     a retenu le signalement (l'alerte de limite part déjà) : un formulaire public ne peut pas en inonder VitFix ;
//   - UN e-mail par destinataire (personne ne voit les autres adresses), repli un par un si le service refuse le lot ;
//     email_erreur résumé, jamais l'adresse ni le texte du service ;
//   - budget d'e-mails (60 / h par copropriété, 300 / h par cabinet), réservé en base AVANT l'envoi : au-delà, le dépôt
//     reste ENREGISTRÉ (réponse inchangée), l'e-mail est retenu, le super admin alerté une fois ; le prochain e-mail
//     parti mentionne les signalements retenus. Les limites du dépôt ne changent pas ;
//   - migration du 11/11/2026 absente : envoi aux adresses saisies, sans budget, comme avant (journalisé une fois).
// PR 2, lot 5 (RG-25) : un gestionnaire à l'accès ouvert reçoit le bouton « Ouvrir le suivi » (/<identifiant>/suivi/,
// aucun jeton) ; l'identifiant du cabinet n'est lu que dans ce cas, et son absence ne change rien au dépôt.
// PR 3, lot 7 (cahier § 6, droit § 5.4) : l'accusé porte les deux phrases du droit § 5.4 seulement si
// signalements_qr_diffusion_annonce le dit (copropriété qui peut diffuser, adresse sans opposition), et la ligne vers la
// politique de confidentialité du cabinet quand il en a une ; l'annonce n'est datée (…_annonce_faite) qu'APRÈS
// l'acceptation de l'accusé par le service d'e-mail. Lu seulement quand un accusé part (limite par adresse non
// atteinte). Migration 20261113 absente ou erreur : accusé d'avant, dépôt acquis.
// Logo du cabinet (demande de Hugo du 13/11/2026) : l'accusé (envoi unitaire) le porte en pièce jointe EN LIGNE ; les
// e-mails aux destinataires (un lot, que Resend ne laisse porter aucune pièce jointe) restent sans logo, jamais avec une
// image distante. Copropriété sans cabinet, cabinet sans logo, migration 20261114 absente ou erreur : accusé d'avant.
// Bâtiments saisis par le cabinet (demande du 17/11/2026 ; un déclarant avait saisi « A » dans le texte libre) : lus
// avec la copropriété du jeton (même requête) ; quand la liste n'est pas vide, un bâtiment absent de la liste est refusé
// (400 batiment_inconnu, message de la page dans sa langue, ni la liste ni la saisie, rien d'écrit ni d'envoyé), la
// comparaison ignore la casse et les espaces en trop, et le nom enregistré (puis envoyé) est celui saisi par le cabinet
// (batimentListeQrSchema). Copropriété sans bâtiment, ou colonne absente (migration du 11/11/2026) : dépôt d'avant.

import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { batimentListeQrSchema, signalementQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { CHEMIN_TABLEAU_QR, numeroSignalementQr, type LangueSignalementQr, type SignalementQr } from '@/lib/vitfixsignal/types'
import { batimentsProposesQr } from '@/lib/vitfixsignal/batiments'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/vitfixsignal/textes'
import {
  coproprieteActiveQr, corrigerEmailsEnvoyesQr, enregistrerEtatEmailsQr, identifiantCabinetDuSuiviQr, insererSignalementQr,
  lireGestionnairesDestinatairesQr, lireRepliSansDestinataireQr, lireSemblablesQr, reponseErreurBase, reponseErreur, reserverEmailsQr,
  signalementDepuisLigne, type LigneCoproprieteQr,
} from '@/lib/vitfixsignal/serveur'
import {
  SANS_CABINET_QR, aucunDestinataireDirectQr, destinatairesSignalementQr, situationAttenteQr,
} from '@/lib/vitfixsignal/destinataires'
import type { CalculDestinatairesQr, SituationAttenteQr } from '@/lib/vitfixsignal/types'
import { urlSuiviCabinetQr } from '@/lib/vitfixsignal/chemin-cabinet'
import {
  ALERTE_LIMITE_ENVOI_QR, ERREUR_LIMITE_ENVOI_QR, alerteBudgetEmailsQr, mentionSignalementsRetenusQr,
} from '@/lib/vitfixsignal/budget-emails'
import {
  FENETRE_CONFIRMATIONS_MS, LIMITE_CONFIRMATIONS_PAR_ADRESSE, alerteSignalementEnAttenteQr, cleLimiteConfirmationQr,
  envoyerAlerteAdministrateurQr, envoyerConfirmationQr, envoyerEmailsSignalementQr, masquerEmailsQr, resumeErreurEnvoiQr,
} from '@/lib/vitfixsignal/email'
import { annonceDiffusionFaiteQr, annonceDiffusionQr, politiqueCabinetDeCoproprieteQr } from '@/lib/vitfixsignal/serveur-information'
import { lireLogoEmailDeCoproprieteQr } from '@/lib/vitfixsignal/serveur-logo'

const CONTEXTE = '[VITFIX SIGNAL]'

/** Bâtiment absent de la liste du cabinet : 400 avec le texte de la page, dans sa langue ; ni la liste ni la saisie. */
const reponseBatimentInconnu = (langue: LangueSignalementQr): NextResponse =>
  NextResponse.json({ error: 'batiment_inconnu', message: TEXTES_SIGNALEMENT_QR[langue].erreurs.batiment_inconnu }, { status: 400 })

/**
 * Bâtiment à enregistrer : la saisie telle quelle quand la copropriété n'a pas de bâtiment saisi (comportement d'avant) ;
 * sinon le nom du cabinet qui lui correspond (casse et espaces en trop ignorés), ou null s'il n'est pas dans la liste.
 */
function batimentAEnregistrer(saisi: string, copropriete: LigneCoproprieteQr): string | null {
  const batiments = batimentsProposesQr(copropriete.batiments)
  if (batiments.length === 0) return saisi
  const controle = validateBody(batimentListeQrSchema(batiments), saisi)
  return controle.success ? controle.data : null
}

/** Erreur conservée (et montrée au super admin) quand la limite par adresse bloque la confirmation. */
const ERREUR_LIMITE_CONFIRMATION = `limite atteinte : ${LIMITE_CONFIRMATIONS_PAR_ADRESSE} confirmations par heure au plus vers cette boîte (variantes « + » comprises)`

/**
 * Récapitulatif au déclarant, après l'enregistrement. Ne lève jamais : un refus de Resend, la limite par adresse ou
 * une exception donnent { envoyeeLe: null, erreur }. La limite compte par boîte (variantes « + » et points Gmail
 * comprises, voir boiteCanoniqueConfirmationQr). L'adresse n'est pas dans la clé du limiteur (empreinte SHA-256) et
 * la route la masque dans ce qu'elle écrit au logger, si le message d'erreur de Resend la cite ; la ligne garde
 * l'erreur brute. Limite connue : en cas d'échec, sendEmail (lib/email.ts, commun à tous les e-mails) écrit lui-même
 * l'erreur brute de Resend dans la console, donc dans les journaux Workers, adresse comprise si Resend la cite.
 * PR 3, lot 7 : annonce de la diffusion et politique du cabinet lues avant l'envoi (jamais d'exception : faux et null
 * en repli) ; annonce datée seulement après l'acceptation d'un accusé qui la portait.
 * Logo du cabinet (13/11/2026) : lu en même temps (jamais d'exception : null en repli), envoyé en pièce jointe en ligne.
 */
async function confirmerAuDeclarant(signalement: SignalementQr, copropriete: LigneCoproprieteQr): Promise<{ envoyeeLe: string | null; erreur: string | null }> {
  try {
    const cle = await cleLimiteConfirmationQr(signalement.email)
    if (!(await checkRateLimit(cle, LIMITE_CONFIRMATIONS_PAR_ADRESSE, FENETRE_CONFIRMATIONS_MS))) {
      logger.warn(`${CONTEXTE} confirmation non envoyée : limite par adresse atteinte`, { signalement: signalement.id })
      return { envoyeeLe: null, erreur: ERREUR_LIMITE_CONFIRMATION }
    }
    const [annoncerDiffusion, politique, logo] = await Promise.all([
      annonceDiffusionQr(signalement.id), politiqueCabinetDeCoproprieteQr(copropriete.id), lireLogoEmailDeCoproprieteQr(copropriete.id),
    ])
    const envoi = await envoyerConfirmationQr({ signalement, copropriete: { nom: copropriete.nom ?? '' }, annoncerDiffusion, politique, logo })
    if (envoi.success) {
      if (annoncerDiffusion) await annonceDiffusionFaiteQr(signalement.id)
      return { envoyeeLe: new Date().toISOString(), erreur: null }
    }
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

type EtatEmailsQr = { emailEnvoyeLe: string | null; emailErreur: string | null }

/** Adresse du tableau des signalements de l'espace global (bouton des alertes au super admin). */
const lienTableauQr = (origine: string | undefined): string => `${(origine ?? 'https://vitfix.io').replace(/\/+$/, '')}${CHEMIN_TABLEAU_QR}`

/**
 * Destinataires du dépôt puis envoi ; ne lève jamais. D9 : le cabinet de la copropriété et son adresse de contact ne
 * sont lus que si la copropriété n'a aucun destinataire direct ; signalement « en attente » (aucun destinataire direct)
 * → après l'envoi, alerte SANS AUCUNE DONNÉE à VitFix, qui dit qui l'a reçu ; aucune si la limite d'envoi l'a retenu.
 */
async function envoyerAuxDestinataires(copropriete: LigneCoproprieteQr, signalement: SignalementQr): Promise<EtatEmailsQr> {
  const lignes = await lireGestionnairesDestinatairesQr(copropriete.id)
  const repli = aucunDestinataireDirectQr(copropriete, lignes) ? await lireRepliSansDestinataireQr(copropriete.id) : SANS_CABINET_QR
  const calcul = destinatairesSignalementQr(copropriete, lignes, repli)
  const { etat, retenuParLaLimite } = await envoyerSignalementQr(copropriete, signalement, calcul)
  if (calcul.enAttente && !retenuParLaLimite) {
    const situation = situationAttenteQr(repli, calcul.destinataires.length, etat.emailEnvoyeLe !== null)
    await alerterSignalementEnAttenteQr(copropriete.id, signalement.id, situation)
  }
  return etat
}

/** D9 : une alerte « en attente » au plus par heure, par copropriété et par situation (formulaire public). */
const FENETRE_ALERTE_ATTENTE_MS = 3_600_000

/**
 * D9 : alerte au super admin (ADMIN_EMAIL, ADMIN_EMAIL_2), sans aucune donnée du signalement, au plus une fois par heure
 * pour une même copropriété dans une même situation (les signalements suivants restent dans le tableau). Ne lève jamais.
 */
async function alerterSignalementEnAttenteQr(coproprieteId: string, signalementId: string, situation: SituationAttenteQr): Promise<void> {
  if (!(await checkRateLimit(`qr_alerte_attente_${coproprieteId}_${situation}`, 1, FENETRE_ALERTE_ATTENTE_MS))) {
    logger.info(`${CONTEXTE} signalement en attente d’un destinataire : alerte déjà envoyée dans l’heure`, { copropriete: coproprieteId, signalement: signalementId, situation })
    return
  }
  const lien = lienTableauQr(process.env.NEXT_PUBLIC_APP_URL || undefined)
  const alerte = await envoyerAlerteAdministrateurQr({ ...alerteSignalementEnAttenteQr(signalementId, situation), lien })
  if (alerte.total === 0) {
    logger.error(`${CONTEXTE} signalement en attente d’un destinataire : aucune adresse ADMIN_EMAIL pour l’alerte`, { signalement: signalementId, situation })
  } else if (alerte.refuses > 0) {
    logger.error(`${CONTEXTE} signalement en attente d’un destinataire : alerte refusée par le service d’e-mail`, {
      signalement: signalementId, situation, refuses: alerte.refuses, total: alerte.total,
    })
  }
}

/**
 * Un e-mail par destinataire, sous budget (RG-06 ter) ; ne lève jamais. Rend l'état à enregistrer : envoyé dès qu'un
 * message est parti ; erreur résumée (nombres seulement) ou limite d'envoi atteinte (retenuParLaLimite).
 */
async function envoyerSignalementQr(
  copropriete: LigneCoproprieteQr, signalement: SignalementQr, { destinataires, auDelaDuPlafond }: CalculDestinatairesQr,
): Promise<{ etat: EtatEmailsQr; retenuParLaLimite: boolean }> {
  if (auDelaDuPlafond > 0) logger.warn(`${CONTEXTE} destinataires au-delà du plafond : non envoyés`, { copropriete: copropriete.id, nombre: auDelaDuPlafond })
  if (destinataires.length === 0) {
    // D9 : seul un signalement en attente peut n'avoir aucun destinataire (ni saisie, ni gestionnaire, ni contact).
    logger.error(`${CONTEXTE} aucun destinataire : ni adresse saisie, ni gestionnaire, ni adresse de contact de cabinet`, { copropriete: copropriete.id })
    return { etat: { emailEnvoyeLe: null, emailErreur: 'aucun destinataire configuré' }, retenuParLaLimite: false }
  }
  const origine = process.env.NEXT_PUBLIC_APP_URL || undefined
  // Budget réservé en base AVANT l'envoi ; null : migration absente ou erreur (envoi sans budget, comme avant).
  const reservation = await reserverEmailsQr(signalement.id, destinataires.length)
  if (reservation && !reservation.accorde) {
    logger.warn(`${CONTEXTE} limite d’envoi atteinte : e-mail retenu, dépôt enregistré`, { copropriete: copropriete.id, signalement: signalement.id })
    if (alerteBudgetEmailsQr(reservation)) {
      const lien = lienTableauQr(origine)
      const alerte = await envoyerAlerteAdministrateurQr({ objet: ALERTE_LIMITE_ENVOI_QR.objet, texte: ALERTE_LIMITE_ENVOI_QR.texte, lien })
      if (alerte.refuses > 0) logger.warn(`${CONTEXTE} alerte de limite d’envoi non envoyée`, { refuses: alerte.refuses, total: alerte.total })
    }
    return { etat: { emailEnvoyeLe: null, emailErreur: ERREUR_LIMITE_ENVOI_QR }, retenuParLaLimite: true }
  }
  // PR 2, lot 5 (RG-25) : bouton « Ouvrir le suivi » des gestionnaires à l'accès ouvert ; le cabinet n'est lu que pour
  // eux, et son absence (migration, erreur) laisse partir l'e-mail avec la phrase de la PR 1.
  const identifiant = destinataires.some((d) => d.type === 'gestionnaire' && d.accesOuvert) ? await identifiantCabinetDuSuiviQr(copropriete.id) : null
  const bilan = await envoyerEmailsSignalementQr({
    destinataires, signalement, copropriete: { nom: copropriete.nom ?? '', adresse: copropriete.adresse ?? '' },
    origine, mention: reservation ? mentionSignalementsRetenusQr(reservation.retenus) : null,
    lienSuivi: identifiant ? urlSuiviCabinetQr(identifiant, origine ?? 'https://vitfix.io') : null,
  })
  if (reservation && bilan.envoyes < destinataires.length) await corrigerEmailsEnvoyesQr(signalement.id, bilan.envoyes)
  const emailErreur = resumeErreurEnvoiQr(bilan)
  if (emailErreur) logger.error(`${CONTEXTE} e-mails refusés par le service`, { signalement: signalement.id, refuses: bilan.refuses, total: bilan.total })
  return { etat: { emailEnvoyeLe: bilan.envoyes > 0 ? new Date().toISOString() : null, emailErreur }, retenuParLaLimite: false }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_signalement_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(signalementQrSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'invalide', details: validation.error }, { status: 400 })
    const saisie = validation.data

    const active = await coproprieteActiveQr(saisie.jeton, { batiments: true })
    if (!active.ok) return active.reponse
    const copropriete = active.copropriete
    if (!(await checkRateLimit(`qr_signalement_copro_${copropriete.id}`, 30, 600_000))) return rateLimitResponse()

    const batiment = batimentAEnregistrer(saisie.batiment, copropriete)
    if (batiment === null) {
      logger.info(`${CONTEXTE} dépôt refusé : bâtiment absent de la liste de la copropriété`, { copropriete: copropriete.id })
      return reponseBatimentInconnu(saisie.langue)
    }

    const ligne = {
      copropriete_id: copropriete.id,
      prenom: saisie.prenom,
      nom: saisie.nom,
      telephone: saisie.telephone,
      // En minuscules : c'est l'adresse de réponse de l'e-mail et une clé de recherche possible.
      email: saisie.email.trim().toLowerCase(),
      batiment,
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
      signalement_lie_id: await resoudreSignalementLie(copropriete.id, { ...saisie, batiment }),
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
    const confirmation = await confirmerAuDeclarant(signalement, copropriete)

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
