// ── E-mails d'un signalement QR : à l'administrateur, puis confirmation au déclarant ──
//
// Envoyés par Resend (lib/email.ts). Module serveur (il importe Resend) : les libellés partagés sont dans
// affichage.ts. Tout ce que le déclarant a saisi est échappé avant d'entrer dans le HTML.
//   - administrateur : destinataires de la copropriété (sinon ADMIN_EMAIL), en français ; « répondre » écrit
//     directement au déclarant (replyTo) ;
//   - déclarant : récapitulatif dans la langue de la page (FR / PT), envoyé à sa seule adresse, sans adresse de
//     réponse ni copie (l'adresse de l'administrateur et celle des destinataires n'y figurent jamais), sans
//     promesse d'intervention ni de délai. Limité par boîte de destination (formulaire public).
// Depuis le 11/11/2026 (gestionnaires d'un cabinet client, SPEC § 1.7) :
//   - le signalement part en UN message par destinataire (sendBatchEmails : un appel, un `to` par message) : personne
//     ne voit les autres adresses ; contenu selon le type (administrateur : bouton de l'espace ; gestionnaire sans accès
//     et adresse saisie : pas de bouton) ; si le service refuse le lot, renvoi un par un (20 au plus) ; le bilan ne
//     garde que des nombres (jamais l'adresse ni le texte du service d'e-mail) ;
//   - confirmation d'adresse d'un gestionnaire (nom court, nom du cabinet, lien du chemin client) et alertes au super
//     admin (adresse contestée, limite d'envoi), sans nom ni adresse de personne. Tout passe par sendBatchEmails :
//     sendEmail écrit l'erreur brute du service dans la console (lib/email.ts).
// PR 2, lot 5 (RG-25) : un gestionnaire à l'accès ouvert reçoit le bouton « Ouvrir le suivi » (espace de son cabinet,
// /<identifiant>/suivi/#signalements, aucun jeton) au lieu de la phrase « Le cabinet suit ce signalement… ».
// PR 3, lot 4 (diffusion aux déclarants) : message d'information sur l'immeuble AU NOM DU CABINET, avec ses en-têtes de
// désinscription, et copie au cabinet (section « Diffusion aux déclarants », en fin de fichier).

import { z } from 'zod'
import { NOREPLY_EMAIL } from '@/lib/constants'
import { sendBatchEmails, sendEmail, type EmailPayload, type EmailResult } from '@/lib/email'
import { logger } from '@/lib/logger'
import { MODELES_DIFFUSION_QR, type ModeleDiffusionQr } from '@/lib/aj-signalement/affichage-diffusion'
import {
  FORMAT_JETON_DIFFUSION_QR, identifiantCabinetLienValideQr, urlPageDesinscriptionQr, urlUnClicDesinscriptionQr,
} from '@/lib/aj-signalement/diffusion-lien'
import { nettoyerLigneDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { PorteeDiffusionQr } from '@/lib/aj-signalement/diffusion-valeurs'
import {
  CHEMIN_TABLEAU_QR, numeroSignalementQr, type BilanEnvoiQr, type DestinataireQr, type LangueSignalementQr, type PrioriteSignalementQr,
  type QualiteDeclarantQr, type SignalementQr, type TypeDestinataireQr,
} from '@/lib/aj-signalement/types'
import {
  LIBELLE_PRIORITE_QR, TEXTES_TABLEAU_QR, dateHeureParis, libelleQualiteQr, lieuSignalementQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'
import { parLangue } from '@/lib/aj-signalement/bilingue'
import { remplir } from '@/lib/coproprietaire/textes'

const ECHAPPEMENTS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Texte sûr dans un attribut ou un contenu HTML. */
export const echapperHtml = (texte: string): string => texte.replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c] ?? c)

/** Objet de l'e-mail : « [AJ Signalement] URGENT — Plomberie (fuite…) — Parc Belle Ombre — lot 12 ». */
export function sujetSignalementQr(s: Pick<SignalementQr, 'priorite' | 'typeIntervention' | 'numLot'>, nomCopropriete: string): string {
  const urgent = s.priorite === 'urgente' ? 'URGENT — ' : ''
  return `[AJ Signalement] ${urgent}${s.typeIntervention} — ${nomCopropriete} — lot ${s.numLot}`
}

export interface ParametresEmailQr {
  copropriete: { nom: string; adresse: string }
  signalement: SignalementQr
  /** Origine du site (lien vers le tableau de bord). */
  origine?: string
  /** Destinataire du message : seul l'administrateur reçoit le bouton de l'espace (défaut : administrateur). */
  destinataire?: TypeDestinataireQr
  /** Signalements retenus pendant la limite d'envoi (budget d'e-mails), sans leur contenu ; null : aucun. */
  mention?: string | null
  /**
   * PR 2, lot 5 (RG-25) : espace du cabinet de la copropriété (urlSuiviCabinetQr, aucun jeton), bouton « Ouvrir le
   * suivi » d'un GESTIONNAIRE à l'accès ouvert. envoyerEmailsSignalementQr ne le passe qu'à ceux-là ; absent : la phrase
   * de la PR 1.
   */
  lienSuivi?: string | null
}

/** Phrase de pied du message d'un gestionnaire sans accès ouvert à l'espace de son cabinet (PR 1). */
const SUIVI_PAR_CABINET_QR = 'Le cabinet suit ce signalement dans AJ Signalement.'

function ligne(libelle: string, valeurHtml: string): string {
  return `<tr>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#4A5E78;white-space:nowrap;vertical-align:top;">${libelle}</td>
      <td style="padding:8px 0;font-size:15px;color:#0D1B2E;vertical-align:top;">${valeurHtml}</td>
    </tr>`
}

export function templateSignalementQr({
  copropriete, signalement: s, origine = 'https://vitfix.io', destinataire = 'administrateur', mention = null, lienSuivi = null,
}: ParametresEmailQr): { subject: string; html: string } {
  const e = echapperHtml
  const telephoneLien = s.telephone.replace(/[\s.()-]/g, '')
  const description = e(s.description).replace(/\r?\n/g, '<br/>')
  const urgent = s.priorite === 'urgente'
  const d = TEXTES_TABLEAU_QR.detail
  const lignes = [
    ligne('Copropriété', `<strong>${e(copropriete.nom)}</strong>${copropriete.adresse ? `<br/><span style="color:#4A5E78;">${e(copropriete.adresse)}</span>` : ''}`),
    // Copropriété sans adresse : celle que la position du déclarant a permis de proposer (texte saisi par le public, échappé).
    s.adresseProposee ? ligne(d.adresseProposee, e(s.adresseProposee)) : '',
    ligne('Déclarant', `<strong>${e(s.prenom)} ${e(s.nom)}</strong>`),
    s.qualiteDeclarant ? ligne(d.qualite, e(libelleQualiteQr(s.qualiteDeclarant))) : '',
    ligne('Téléphone', `<a href="tel:${e(telephoneLien)}" style="color:#0D1B2E;">${e(s.telephone)}</a>`),
    ligne('E-mail', `<a href="mailto:${e(s.email)}" style="color:#0D1B2E;">${e(s.email)}</a>`),
    ligne('Lot', `${s.batiment ? `bât. ${e(s.batiment)} · ` : ''}étage ${e(s.etage)} · lot ${e(s.numLot)}`),
    ligne('Lieu du problème', e(lieuSignalementQr(s))),
    s.signalementLieId ? ligne(d.signalementLie, `<strong>${e(texteSignalementLieQr(s.signalementLieId))}</strong>`) : '',
    ligne('Type', e(s.typeIntervention)),
    ligne('Urgence', urgent ? '<strong style="color:#9B2C20;">Urgent</strong>' : e(LIBELLE_PRIORITE_QR[s.priorite])),
    ligne('Déposé le', e(dateHeureParis(s.creeLe))),
    ligne('Numéro', e(numeroSignalementQr(s.id))),
  ].join('')
  const urlTableau = `${origine.replace(/\/+$/, '')}${CHEMIN_TABLEAU_QR}`
  const boutonVers = (url: string, libelle: string) => `<p style="margin:16px 0 0;">
            <a href="${e(url)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">${libelle}</a>
          </p>`
  // Bouton de l'espace global : l'administrateur seul. Gestionnaire à l'accès ouvert (PR 2) : l'espace de son cabinet,
  // sans jeton ; gestionnaire sans accès : la phrase de la PR 1 ; adresse saisie : rien.
  const suiviGestionnaire = destinataire === 'gestionnaire' && lienSuivi ? lienSuivi : null
  let bouton = ''
  if (destinataire === 'administrateur') bouton = boutonVers(urlTableau, 'Ouvrir le tableau des signalements')
  else if (suiviGestionnaire) bouton = boutonVers(suiviGestionnaire, 'Ouvrir le suivi')
  const suivi = destinataire === 'gestionnaire' && !suiviGestionnaire
    ? `<p style="margin:8px 0 0;font-size:13px;color:#4A5E78;">${SUIVI_PAR_CABINET_QR}</p>`
    : ''
  const rappel = mention
    ? `<p style="margin:0 0 16px;padding:10px 14px;background:#F7F4EE;border-radius:10px;color:#0D1B2E;font-size:14px;">${e(mention)}</p>`
    : ''

  const corps = `${urgent ? '<p style="margin:0 0 16px;padding:10px 14px;background:#FBE4E1;border-radius:10px;color:#6E1C13;font-size:14px;font-weight:600;">Le déclarant indique une urgence (fuite importante, panne d’ascenseur, danger).</p>' : ''}
          ${rappel}<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lignes}</table>
          ${blocDescription('Description', description)}
          <p style="margin:24px 0 0;font-size:13px;color:#4A5E78;">Répondre à cet e-mail écrit directement au déclarant.</p>
          ${suivi}${bouton}`
  const html = cadreEmailQr({
    langue: 'fr',
    titreHtml: `${urgent ? 'Signalement urgent' : 'Nouveau signalement'} — ${e(copropriete.nom)}`,
    corpsHtml: corps,
    piedHtml: 'Signalement déposé par QR code sur AJ Signalement — VITFIX. Cet e-mail a été envoyé automatiquement.',
  })
  return { subject: sujetSignalementQr(s, copropriete.nom), html }
}

/** Libellé puis description (déjà échappée, retours à la ligne en <br/>). */
function blocDescription(libelle: string, descriptionHtml: string): string {
  return `<p style="margin:20px 0 6px;font-size:13px;color:#4A5E78;">${libelle}</p>
          <div style="padding:14px 16px;background:#F7F4EE;border-radius:12px;font-size:15px;line-height:1.55;color:#0D1B2E;">${descriptionHtml}</div>`
}

/**
 * Cadre commun des e-mails : bandeau (« AJ SIGNALEMENT » par défaut ; nom du cabinet pour une diffusion, PR 3) et
 * titre, contenu, pied de page. Contenus déjà échappés.
 */
function cadreEmailQr(p: { langue: LangueSignalementQr; titreHtml: string; corpsHtml: string; piedHtml: string; bandeauHtml?: string }): string {
  return `<!DOCTYPE html>
<html lang="${p.langue}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0D1B2E;padding:24px 32px;">
          <span style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1.5px;">${p.bandeauHtml ?? 'AJ SIGNALEMENT'}</span><br/>
          <span style="color:#FFFFFF;font-size:22px;font-weight:700;">${p.titreHtml}</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${p.corpsHtml}
        </td></tr>
        <tr><td style="background:#F7F4EE;padding:18px 32px;border-top:1px solid #E4DDD0;">
          <p style="margin:0;font-size:12px;color:#8A9BB0;text-align:center;">${p.piedHtml}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Envoi par lot, un message par destinataire ───────────────────────────────

/** Renvois un par un au plus, quand le service refuse tout le lot (une seule adresse refusée suffit chez Resend). */
export const REPLIS_UN_PAR_UN_MAX_QR = 20

const BILAN_VIDE: BilanEnvoiQr = { envoyes: 0, refuses: 0, total: 0 }

/** Un message, jamais d'exception : vrai si le service l'a accepté. */
async function envoyerUnQr(message: EmailPayload): Promise<boolean> {
  try {
    const r = await sendBatchEmails([message])
    return r.failed === 0 && r.sent > 0
  } catch {
    // Le texte de l'exception (adresse comprise, parfois) n'est jamais journalisé : le bilan compte le refus.
    logger.warn('[AJ SIGNALEMENT] envoi d’un message impossible (exception du service d’e-mail)')
    return false
  }
}

/**
 * Envoie des messages (un `to` chacun) en un appel ; si le service refuse le lot, les renvoie un par un (les
 * REPLIS_UN_PAR_UN_MAX_QR premiers ; les suivants sont comptés refusés). Ne lève jamais ; rend des nombres seulement.
 */
export async function envoyerParLotQr(messages: readonly EmailPayload[]): Promise<BilanEnvoiQr> {
  if (messages.length === 0) return { ...BILAN_VIDE }
  let lot: { sent: number; failed: number } | null
  try {
    lot = await sendBatchEmails([...messages])
  } catch {
    // Même traitement qu'un lot refusé (repli un par un) ; aucun texte du service n'est gardé ni journalisé.
    logger.warn('[AJ SIGNALEMENT] envoi par lot impossible (exception du service d’e-mail) : repli un par un', { messages: messages.length })
    lot = null
  }
  if (lot && lot.failed === 0) return { envoyes: Math.min(lot.sent, messages.length), refuses: 0, total: messages.length }
  if (messages.length === 1) return { envoyes: 0, refuses: 1, total: 1 }
  let envoyes = 0
  for (const message of messages.slice(0, REPLIS_UN_PAR_UN_MAX_QR)) {
    if (await envoyerUnQr(message)) envoyes += 1
  }
  return { envoyes, refuses: messages.length - envoyes, total: messages.length }
}

/** email_erreur d'un signalement : « 2 envoi(s) sur 7 refusé(s) par le service d’e-mail » ; null si tout est parti. */
export function resumeErreurEnvoiQr(bilan: BilanEnvoiQr): string | null {
  return bilan.refuses > 0 ? `${bilan.refuses} envoi(s) sur ${bilan.total} refusé(s) par le service d’e-mail` : null
}

/**
 * Signalement à ses destinataires : un message par destinataire (contenu selon son type), réponse directe au déclarant.
 * Ne lève jamais.
 */
export async function envoyerEmailsSignalementQr(
  p: Omit<ParametresEmailQr, 'destinataire'> & { destinataires: readonly DestinataireQr[] },
): Promise<BilanEnvoiQr> {
  const messages: EmailPayload[] = p.destinataires.map((d) => {
    // RG-25 : le lien de suivi n'est donné qu'à un gestionnaire dont l'accès est ouvert (compte relié, non bloqué).
    const lienSuivi = d.type === 'gestionnaire' && d.accesOuvert ? p.lienSuivi ?? null : null
    const { subject, html } = templateSignalementQr({ ...p, destinataire: d.type, lienSuivi })
    return { to: d.email, subject, html, replyTo: p.signalement.email, tags: [{ name: 'type', value: 'aj-signalement' }] }
  })
  return envoyerParLotQr(messages)
}

// ── Confirmation d'adresse d'un gestionnaire (SPEC § 1.7.3) ──────────────────

export interface ParametresConfirmationAdresseQr {
  /** « Marie M. » (nomCourtQr), texte brut : échappé ici. */
  nomCourt: string
  /** Nom du cabinet client (signalements_qr_cabinets.nom). */
  cabinet: string
  /** /<identifiant>/confirmation-adresse/#<jeton> : le jeton est après le « # ». */
  lien: string
}

/**
 * La confirmation prouve la boîte, pas l'identité (RG-02) : l'e-mail nomme la personne et le cabinet pour qu'un mauvais
 * destinataire se reconnaisse et clique « Ce n'est pas moi ». Aucune donnée de copropriété ni de signalement. FR seul.
 */
export function templateConfirmationAdresseQr({ nomCourt, cabinet, lien }: ParametresConfirmationAdresseQr): { subject: string; html: string } {
  const e = echapperHtml
  const paragraphe = (texte: string, marge = '0 0 14px') => `<p style="margin:${marge};font-size:15px;line-height:1.55;color:#0D1B2E;">${texte}</p>`
  const corps = `${paragraphe(`Bonjour ${e(nomCourt)},`)}
          ${paragraphe(`${e(cabinet)} vous a désigné(e) comme gestionnaire dans AJ Signalement. Confirmez votre adresse pour recevoir les signalements de vos copropriétés (ils contiennent les coordonnées des résidents qui les déposent). Ce lien est valable 7 jours.`)}
          <p style="margin:20px 0;">
            <a href="${e(lien)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Confirmer mon adresse</a>
          </p>
          ${paragraphe(`<strong>Vous n’êtes pas ${e(nomCourt)}, gestionnaire chez ${e(cabinet)} ?</strong> Ouvrez le lien et cliquez « Ce n’est pas moi » : le cabinet sera prévenu et vous ne recevrez rien.`)}
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#4A5E78;">Vos nom et adresse professionnelle sont traités par votre employeur pour le suivi des signalements (VitFix, sous-traitant). Durée : le temps de votre mission, puis 12 mois. Contact : votre employeur. <a href="https://vitfix.io/fr/confidentialite/" style="color:#4A5E78;">Politique de confidentialité</a></p>`
  const html = cadreEmailQr({
    langue: 'fr',
    titreHtml: 'Confirmez votre adresse',
    corpsHtml: corps,
    piedHtml: 'AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.',
  })
  return { subject: `AJ Signalement — ${cabinet} : confirmez votre adresse`, html }
}

/** Envoie la confirmation à la seule adresse de la fiche (sendBatchEmails) ; vrai si partie. Ne lève jamais. */
export async function envoyerConfirmationAdresseQr(p: ParametresConfirmationAdresseQr & { email: string }): Promise<boolean> {
  const { subject, html } = templateConfirmationAdresseQr(p)
  return envoyerUnQr({ to: p.email, subject, html, tags: [{ name: 'type', value: 'aj-signalement-adresse' }] })
}

// ── Ouverture de l'accès d'un gestionnaire à l'espace de son cabinet (PR 2, SPEC § 2.3.2) ──

/** Mêmes paramètres que la confirmation d'adresse ; lien /<identifiant>/invitation/#<jeton> (jeton après le « # »). */
export type ParametresAccesGestionnaireQr = ParametresConfirmationAdresseQr

/**
 * Accès au suivi des signalements de ses copropriétés (compte professionnel VitFix, mot de passe choisi sur la page du
 * lien). Comme la confirmation, l'e-mail nomme la personne et le cabinet pour qu'un mauvais destinataire réponde « Ce
 * n'est pas moi ». Aucune donnée de copropriété ni de signalement, aucun mot de passe. FR seul (tout l'espace est en
 * français).
 */
export function templateAccesGestionnaireQr({ nomCourt, cabinet, lien }: ParametresAccesGestionnaireQr): { subject: string; html: string } {
  const e = echapperHtml
  const paragraphe = (texte: string, marge = '0 0 14px') => `<p style="margin:${marge};font-size:15px;line-height:1.55;color:#0D1B2E;">${texte}</p>`
  const corps = `${paragraphe(`Bonjour ${e(nomCourt)},`)}
          ${paragraphe(`${e(cabinet)} vous ouvre un accès à son espace AJ Signalement : vous y suivrez les signalements de vos copropriétés et pourrez changer leur statut. Choisissez votre mot de passe pour créer votre compte professionnel. Ce lien est valable 7 jours et ne sert qu’une fois.`)}
          <p style="margin:20px 0;">
            <a href="${e(lien)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ouvrir mon accès</a>
          </p>
          ${paragraphe(`<strong>Vous n’êtes pas ${e(nomCourt)}, gestionnaire chez ${e(cabinet)} ?</strong> Ouvrez le lien et cliquez « Ce n’est pas moi » : le cabinet sera prévenu et aucun compte ne sera créé.`)}
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#4A5E78;">Vos nom et adresse professionnelle sont traités par votre employeur pour le suivi des signalements (VitFix, sous-traitant). Durée : le temps de votre mission, puis 12 mois. Contact : votre employeur. <a href="https://vitfix.io/fr/confidentialite/" style="color:#4A5E78;">Politique de confidentialité</a></p>`
  const html = cadreEmailQr({
    langue: 'fr',
    titreHtml: 'Votre accès à AJ Signalement',
    corpsHtml: corps,
    piedHtml: 'AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.',
  })
  return { subject: `AJ Signalement — ${cabinet} : ouvrez votre accès`, html }
}

/** Envoie l'accès à la seule adresse de la fiche (sendBatchEmails) ; vrai si parti. Ne lève jamais. */
export async function envoyerAccesGestionnaireQr(p: ParametresAccesGestionnaireQr & { email: string }): Promise<boolean> {
  const { subject, html } = templateAccesGestionnaireQr(p)
  return envoyerUnQr({ to: p.email, subject, html, tags: [{ name: 'type', value: 'aj-signalement-acces' }] })
}

// ── Alertes au super admin (sans nom ni adresse de personne) ─────────────────

/** « Ce n'est pas moi » (P1-R17b ; aussi depuis un lien d'accès, P2-R3b). */
export const ALERTE_ADRESSE_CONTESTEE_QR = {
  objet: 'AJ Signalement — adresse de gestionnaire contestée',
  texte: 'Une adresse de gestionnaire a été contestée par son destinataire : aucun e-mail ne lui sera envoyé. Créez une fiche avec la bonne adresse, puis faites le départ de la fiche contestée.',
} as const

/** Acceptation d'un accès refusée : l'adresse est celle d'un compte VitFix d'un autre espace (P2-R3, jamais converti). */
export const ALERTE_REFUS_AUTRE_ESPACE_QR = {
  objet: 'AJ Signalement — accès d’un gestionnaire refusé (adresse d’un autre espace)',
  texte: 'L’adresse d’un gestionnaire est déjà celle d’un compte VitFix d’un autre espace : son accès n’a pas été ouvert (un compte existant n’est jamais converti). Créez une fiche avec une autre adresse, puis faites le départ de celle-ci.',
} as const

/** Accès accepté, mais le compte n'a pas pu être relié à la fiche (contrôle après coup de P2-R3). */
export const ALERTE_LIAISON_INCOMPLETE_QR = {
  objet: 'AJ Signalement — accès d’un gestionnaire à vérifier',
  texte: 'Un gestionnaire a accepté son accès, mais son compte n’a pas pu être relié à sa fiche. Ouvrez la fiche, puis renvoyez l’accès : le compte existant sera rattaché.',
} as const

/**
 * Un gestionnaire a demandé, depuis son compte, la suppression de ses données (RGPD, delete-account refusé : son compte
 * est géré par le cabinet, responsable de traitement). PR 2, lot 6.
 */
export const ALERTE_EFFACEMENT_DEMANDE_QR = {
  objet: 'AJ Signalement — demande d’effacement d’un gestionnaire',
  texte: 'Un gestionnaire a demandé la suppression de ses données depuis son compte. Rien n’a été supprimé : transmettez la demande au cabinet ; s’il l’accepte, faites le départ de la fiche, puis « Effacer ses données ».',
} as const

export function templateAlerteAdministrateurQr(p: { objet: string; texte: string; lien: string }): { subject: string; html: string } {
  const e = echapperHtml
  const corps = `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0D1B2E;">${e(p.texte)}</p>
          <p style="margin:16px 0 0;">
            <a href="${e(p.lien)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ouvrir AJ Signalement</a>
          </p>`
  const html = cadreEmailQr({
    langue: 'fr', titreHtml: 'Alerte', corpsHtml: corps,
    piedHtml: 'AJ Signalement — VITFIX. Cet e-mail a été envoyé automatiquement.',
  })
  return { subject: p.objet, html }
}

/** Une alerte à chaque adresse ADMIN_EMAIL / ADMIN_EMAIL_2 (un message chacune). Ne lève jamais. */
export async function envoyerAlerteAdministrateurQr(
  p: { objet: string; texte: string; lien: string }, env: Record<string, string | undefined> = process.env,
): Promise<BilanEnvoiQr> {
  const adresses = [...new Set([env.ADMIN_EMAIL, env.ADMIN_EMAIL_2].map((a) => (a ?? '').trim().toLowerCase()).filter((a) => a.includes('@')))]
  const { subject, html } = templateAlerteAdministrateurQr(p)
  return envoyerParLotQr(adresses.map((to) => ({ to, subject, html, tags: [{ name: 'type', value: 'aj-signalement-alerte' }] })))
}

// ── Confirmation au déclarant ────────────────────────────────────────────────

/**
 * Règle de gestion (06/11/2026) : au plus 3 confirmations par heure vers une même boîte. Le formulaire est
 * public : sans cette limite, il servirait à faire envoyer des courriels VITFIX à une adresse tierce (les
 * limites par IP et par copropriété de la route s'ajoutent). Au-delà, le dépôt est enregistré sans confirmation.
 */
export const LIMITE_CONFIRMATIONS_PAR_ADRESSE = 3
export const FENETRE_CONFIRMATIONS_MS = 60 * 60 * 1000

/** Domaines Gmail : les points de la partie locale y sont ignorés et googlemail.com est la même boîte que gmail.com. */
const DOMAINES_GMAIL = new Set(['gmail.com', 'googlemail.com'])

/**
 * Boîte canonique, pour la seule clé du limiteur (la confirmation part toujours à l'adresse saisie) : minuscules,
 * partie locale coupée au premier « + » quel que soit le domaine (sous-adresses de Gmail, Outlook…, limiter un peu
 * trop ne fait aucun tort), et pour Gmail points retirés et domaine ramené à gmail.com. Sans cela, victime+1@…,
 * victime+2@… ou v.ictime@gmail.com auraient chacune leur compteur et arriveraient dans la même boîte.
 */
export function boiteCanoniqueConfirmationQr(email: string): string {
  const adresse = email.trim().toLowerCase()
  const arobase = adresse.lastIndexOf('@')
  if (arobase < 0) return adresse
  let locale = adresse.slice(0, arobase).split('+')[0]
  let domaine = adresse.slice(arobase + 1)
  if (DOMAINES_GMAIL.has(domaine)) {
    locale = locale.replaceAll('.', '')
    domaine = 'gmail.com'
  }
  return `${locale}@${domaine}`
}

/** Clé du limiteur : empreinte SHA-256 de la boîte canonique ; l'adresse n'est jamais écrite en clair dans Redis. */
export async function cleLimiteConfirmationQr(email: string): Promise<string> {
  const octets = new TextEncoder().encode(boiteCanoniqueConfirmationQr(email))
  const empreinte = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', octets))
  return `qr_confirmation_${Array.from(empreinte, (o) => o.toString(16).padStart(2, '0')).join('')}`
}

/** Caractères qui bornent une adresse dans un message : espaces, chevrons, guillemets, accent grave (et « @ », à part). */
const BORNE_ADRESSE = /([\s<>"'`])/

/**
 * Remplace par « [e-mail] » toute adresse (« partie@domaine ») d'un message que la route écrit au logger. Mêmes
 * remplacements que /[^\s@<>"'`]+@[^\s@<>"'`]+/g, mais en temps linéaire : cette expression, réessayée à chaque
 * position, revenait en arrière sur toute la suite de caractères (temps quadratique sur un long message sans « @ »).
 * Le message est découpé aux bornes, puis chaque mot à ses « @ » : deux parties non vides de part et d'autre d'un
 * « @ » forment une adresse, lue de gauche à droite comme le faisait l'expression.
 */
export function masquerEmailsQr(texte: string): string {
  return texte.split(BORNE_ADRESSE).map((morceau, i) => (i % 2 === 1 ? morceau : masquerAdressesDuMot(morceau))).join('')
}

/** Mot sans borne : « a@b » devient « [e-mail] », « a@b@c » devient « [e-mail]@c », « a@@b » reste tel quel. */
function masquerAdressesDuMot(mot: string): string {
  const parties = mot.split('@')
  const sortie: string[] = []
  let i = 0
  while (i < parties.length) {
    const adresse = parties[i] !== '' && (parties[i + 1] ?? '') !== ''
    sortie.push(adresse ? '[e-mail]' : parties[i])
    i += adresse ? 2 : 1
  }
  return sortie.join('@')
}

export interface TextesConfirmationQr {
  sujet: string
  titre: string
  bonjour: string
  introduction: string
  recapitulatif: string
  numero: string
  copropriete: string
  deposeLe: string
  heureParis: string
  qualite: string
  qualites: Record<QualiteDeclarantQr, string>
  lieu: string
  zone: string
  signalementLie: string
  memeProbleme: string
  type: string
  urgence: string
  description: string
  partiesCommunes: string
  votreLogement: string
  batiment: string
  etage: string
  lot: string
  priorites: Record<PrioriteSignalementQr, string>
  suiteTitre: string
  suite: string
  conserverNumero: string
  pasDeReponse: string
  pasVous: string
  piedDePage: string
  /** PR 3, lot 7 : les deux phrases du droit § 5.4 (FR exact ; PT proposé, H4), seulement si la diffusion est annoncée. */
  confirmationChaqueDepot: string
  annonceDiffusion: string
  /** PR 3, lot 7 : ligne d'information (art. 13 du RGPD, droit § 4.5) quand le cabinet a une politique. */
  traitesPar: string
  politique: string
}

/** Textes de la confirmation, dans la langue de la page publique. Aucune promesse d'intervention ni de délai. */
export const TEXTES_CONFIRMATION_QR: Record<LangueSignalementQr, TextesConfirmationQr> = parLangue<TextesConfirmationQr>({
  sujet: {
    fr: 'Votre signalement n° {numero} a bien été enregistré — {copropriete}',
    pt: 'A sua ocorrência n.º {numero} foi registada — {copropriete}',
  },
  titre: { fr: 'Votre signalement est enregistré', pt: 'A sua ocorrência foi registada' },
  bonjour: { fr: 'Bonjour,', pt: 'Olá,' },
  introduction: {
    fr: 'Votre signalement pour la copropriété {copropriete} a bien été enregistré sous le numéro {numero}.',
    pt: 'A sua ocorrência relativa ao condomínio {copropriete} foi registada com o número {numero}.',
  },
  recapitulatif: { fr: 'Ce que vous avez déclaré', pt: 'O que declarou' },
  numero: { fr: 'Numéro', pt: 'Número' },
  copropriete: { fr: 'Copropriété', pt: 'Condomínio' },
  deposeLe: { fr: 'Déposé le', pt: 'Registada em' },
  heureParis: { fr: '(heure de Paris)', pt: '(hora de Paris)' },
  qualite: { fr: 'Vous êtes', pt: 'Na qualidade de' },
  qualites: parLangue({
    proprietaire: { fr: 'Propriétaire', pt: 'Proprietário' },
    locataire: { fr: 'Locataire', pt: 'Inquilino' },
  }),
  lieu: { fr: 'Lieu du problème', pt: 'Local do problema' },
  zone: { fr: 'Zone', pt: 'Zona' },
  signalementLie: { fr: 'Signalement lié', pt: 'Ocorrência associada' },
  memeProbleme: { fr: 'Même problème que le signalement n° {numero}', pt: 'Mesmo problema que a ocorrência n.º {numero}' },
  type: { fr: 'Type de problème', pt: 'Tipo de problema' },
  urgence: { fr: 'Urgence', pt: 'Urgência' },
  description: { fr: 'Description', pt: 'Descrição' },
  partiesCommunes: { fr: 'Parties communes', pt: 'Partes comuns' },
  votreLogement: { fr: 'Votre logement', pt: 'A sua habitação' },
  batiment: { fr: 'bât.', pt: 'bloco' },
  etage: { fr: 'étage', pt: 'piso' },
  lot: { fr: 'lot', pt: 'fração' },
  priorites: parLangue({
    urgente: { fr: 'Urgent', pt: 'Urgente' },
    normale: { fr: 'Normal', pt: 'Normal' },
    planifiee: { fr: 'À planifier', pt: 'A planear' },
  }),
  suiteTitre: { fr: 'Et maintenant ?', pt: 'E agora?' },
  suite: {
    fr: 'Votre signalement a été transmis à l’administrateur de la copropriété, qui pourra vous recontacter au téléphone ou à l’adresse e-mail que vous avez indiqués.',
    pt: 'A sua ocorrência foi transmitida ao administrador do condomínio, que poderá contactá-lo pelo telefone ou pelo endereço de e-mail que indicou.',
  },
  conserverNumero: {
    fr: 'Gardez ce numéro : il permet de retrouver votre signalement si vous en reparlez avec l’administrateur.',
    pt: 'Guarde este número: permite identificar a sua ocorrência se voltar a falar dela com o administrador.',
  },
  pasDeReponse: { fr: 'Message automatique : ne répondez pas à cet e-mail.', pt: 'Mensagem automática: não responda a este e-mail.' },
  pasVous: {
    fr: 'Si vous n’êtes pas à l’origine de ce signalement, ignorez ce message.',
    pt: 'Se não foi o autor desta ocorrência, ignore esta mensagem.',
  },
  piedDePage: {
    fr: 'AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.',
    pt: 'AJ Signalement — um serviço VITFIX. Este e-mail foi enviado automaticamente.',
  },
  // Droit § 5.4, « Dans l'accusé de réception (a) — pas de bouton, mais ces deux phrases » : texte exact, à ne changer
  // qu'après relecture de la note (structure figée par tests/api/aj-signalement-signalements.test.ts).
  confirmationChaqueDepot: {
    fr: 'Ce message confirme votre signalement. Vous le recevrez à chaque fois que vous en déposez un.',
    pt: 'Esta mensagem confirma a sua ocorrência. Receberá uma confirmação como esta sempre que registar uma.',
  },
  annonceDiffusion: {
    fr: 'Vous recevrez aussi les informations sur votre immeuble (fuite, coupure, intervention) ; chacune de ces informations comporte un bouton pour ne plus les recevoir.',
    pt: 'Receberá também as informações sobre o seu prédio (fuga, corte, intervenção); cada uma destas informações inclui um botão para deixar de as receber.',
  },
  traitesPar: { fr: 'Vos coordonnées sont traitées par {cabinet} :', pt: 'Os seus dados são tratados por {cabinet}:' },
  politique: { fr: 'Politique de confidentialité', pt: 'Política de privacidade' },
})

/** Objet : « Votre signalement n° 5F2C9A1E a bien été enregistré — Parc Belle Ombre » (texte brut, pas de HTML). */
export function sujetConfirmationQr(numero: string, nomCopropriete: string, langue: LangueSignalementQr): string {
  return remplir(TEXTES_CONFIRMATION_QR[langue].sujet, { numero, copropriete: nomCopropriete })
}

/** Politique de confidentialité du cabinet de la copropriété (serveur-information.ts) : nom affiché et adresse https. */
export interface PolitiqueCabinetQr {
  cabinet: string
  url: string
}

export interface ParametresConfirmationQr {
  copropriete: { nom: string }
  /** Le signalement enregistré ; sa langue est celle de la page publique. */
  signalement: SignalementQr
  /**
   * PR 3, lot 7 : signalements_qr_diffusion_annonce(signalement) — copropriété qui peut diffuser et adresse sans
   * opposition. Vrai : les deux phrases du droit § 5.4. Absent ou faux : accusé sans elles.
   */
  annoncerDiffusion?: boolean
  /** PR 3, lot 7 : politique du cabinet ; présente et bien formée : la ligne d'information et son lien (seul lien). */
  politique?: PolitiqueCabinetQr | null
}

/** « Parties communes » ou « Votre logement (bât. B · étage 4 · lot 12) », valeurs échappées. */
function lieuConfirmationHtml(s: SignalementQr, t: TextesConfirmationQr): string {
  if (s.estPartieCommune) return t.partiesCommunes
  const e = echapperHtml
  const situation = [
    s.batiment ? `${t.batiment} ${e(s.batiment)}` : '',
    s.etage ? `${t.etage} ${e(s.etage)}` : '',
    s.numLot ? `${t.lot} ${e(s.numLot)}` : '',
  ].filter(Boolean).join(' · ')
  return situation ? `${t.votreLogement} (${situation})` : t.votreLogement
}

/**
 * Ligne d'information de l'accusé (cahier § 6 ; relecture droit B1) : « Vos coordonnées sont traitées par {cabinet} :
 * Politique de confidentialité » (lien). Information due à la collecte (art. 13 du RGPD, droit § 4.5), pas une
 * information sur l'immeuble : elle ne fait pas de l'accusé une diffusion (droit § 5.4, condition 1). Seul lien
 * possible de l'accusé ; '' si la politique manque ou sort de la forme de la contrainte de la base, ou sans nom.
 */
function ligneInformationConfirmationQr(t: TextesConfirmationQr, politique: PolitiqueCabinetQr | null | undefined): string {
  if (!politique || !politiqueConfidentialiteValideQr(politique.url)) return ''
  const cabinet = nettoyerLigneDiffusionQr(politique.cabinet)
  if (!cabinet) return ''
  const e = echapperHtml
  return `
          <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#4A5E78;">${e(remplir(t.traitesPar, { cabinet }))} <a href="${e(politique.url)}" style="color:#4A5E78;">${e(t.politique)}</a></p>`
}

/**
 * E-mail de confirmation : numéro, copropriété, date et heure de Paris, récapitulatif de la déclaration, suite.
 * Ni nom, ni téléphone, ni adresse e-mail (de personne), ni lien vers le tableau de bord.
 * PR 3, lot 7 (cahier § 6, droit § 5.4) : l'accusé reste un accusé. Seuls ajouts possibles, tous deux facultatifs :
 *   - après « Gardez ce numéro », les deux phrases EXACTES du droit § 5.4 quand la diffusion est annoncée
 *     (annoncerDiffusion) ;
 *   - avant le pied, la ligne vers la politique de confidentialité du cabinet quand il en a une (seul href).
 * Ni bouton, ni autre texte, ni en-tête de désinscription ; structure figée par un test (liste exacte des blocs). Sans
 * ces deux options, la sortie est identique à celle d'avant la PR 3.
 */
export function templateConfirmationQr({
  copropriete, signalement: s, annoncerDiffusion = false, politique = null,
}: ParametresConfirmationQr): { subject: string; html: string } {
  const e = echapperHtml
  const t = TEXTES_CONFIRMATION_QR[s.langue]
  const numero = numeroSignalementQr(s.id)
  const lignes = [
    ligne(t.numero, `<strong>${e(numero)}</strong>`),
    ligne(t.copropriete, e(copropriete.nom)),
    ligne(t.deposeLe, `${e(dateHeureParis(s.creeLe, s.langue))} ${t.heureParis}`),
    s.qualiteDeclarant ? ligne(t.qualite, e(t.qualites[s.qualiteDeclarant])) : '',
    ligne(t.lieu, lieuConfirmationHtml(s, t)),
    s.estPartieCommune && s.zoneSignalee ? ligne(t.zone, e(s.zoneSignalee)) : '',
    s.signalementLieId ? ligne(t.signalementLie, e(remplir(t.memeProbleme, { numero: numeroSignalementQr(s.signalementLieId) }))) : '',
    ligne(t.type, e(s.typeIntervention)),
    ligne(t.urgence, e(t.priorites[s.priorite])),
  ].join('')
  const paragraphe = (texte: string, marge = '0 0 14px') => `<p style="margin:${marge};font-size:15px;line-height:1.55;color:#0D1B2E;">${texte}</p>`
  const intertitre = (texte: string) => `<p style="margin:24px 0 6px;font-size:13px;font-weight:700;color:#4A5E78;">${texte}</p>`
  // Ajouts de la PR 3, collés aux blocs qui les précèdent : absents, le HTML est octet pour octet celui d'avant.
  const annonce = annoncerDiffusion
    ? `
          ${paragraphe(`${e(t.confirmationChaqueDepot)}<br/>${e(t.annonceDiffusion)}`, '12px 0 0')}`
    : ''

  const corps = `${paragraphe(t.bonjour)}
          ${paragraphe(remplir(t.introduction, { copropriete: `<strong>${e(copropriete.nom)}</strong>`, numero: `<strong>${e(numero)}</strong>` }), '0 0 4px')}
          ${intertitre(t.recapitulatif)}
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lignes}</table>
          ${blocDescription(t.description, e(s.description).replace(/\r?\n/g, '<br/>'))}
          ${intertitre(t.suiteTitre)}
          ${paragraphe(t.suite, '0')}
          ${paragraphe(t.conserverNumero, '12px 0 0')}${annonce}
          <p style="margin:24px 0 0;font-size:13px;color:#4A5E78;">${t.pasDeReponse}<br/>${t.pasVous}</p>${ligneInformationConfirmationQr(t, politique)}`
  const html = cadreEmailQr({ langue: s.langue, titreHtml: t.titre, corpsHtml: corps, piedHtml: t.piedDePage })
  return { subject: sujetConfirmationQr(numero, copropriete.nom, s.langue), html }
}

/**
 * Envoie la confirmation à la seule adresse du déclarant : ni adresse de réponse, ni copie (une réponse irait à
 * l'expéditeur, VITFIX <noreply@vitfix.io> par défaut). Ne lève jamais en temps normal (sendEmail rend success / error).
 */
export async function envoyerConfirmationQr(p: ParametresConfirmationQr): Promise<EmailResult> {
  const { subject, html } = templateConfirmationQr(p)
  return sendEmail({
    to: [p.signalement.email],
    subject,
    html,
    tags: [{ name: 'type', value: 'aj-signalement-confirmation' }],
  })
}

// ── Diffusion aux déclarants (PR 3, lot 4) ───────────────────────────────────
//
// Cahier PR 3 § 5.1 (enveloppe), § 5.2 (gabarit), § 5.6 (copie au cabinet), § 3.8 et décision H1 (message d'annonce
// unique, même gabarit). Le message est écrit AU NOM DU CABINET : bandeau, signature, pied, nom d'affichage et Reply-To
// sont ceux du cabinet. VitFix et « AJ Signalement » n'y sont nommés nulle part (droit § 4.1 : ni auteur apparent, ni
// promotion d'un prestataire ; VitFix est nommé dans la politique du cabinet, comme sous-traitant). Le domaine
// technique vitfix.io n'apparaît que dans l'adresse du lien de désinscription et, tant que le cabinet ne donne pas ses
// DNS, dans l'adresse d'expédition (F6).
// Sortie DÉTERMINISTE : seules les valeurs figées de la diffusion (fige_*, objet, texte, libellé du périmètre) et les
// jetons signés, recalculés à l'identique (diffusion-lien.ts), y entrent ; aucune date de génération. Un lot rejoué
// produit donc le même contenu, condition de l'idempotence du service d'e-mail (§ 5.5).
// Exactement deux liens : le bouton de désinscription (jeton de PAGE, dans le fragment) et la politique de
// confidentialité du cabinet ; le jeton UN CLIC n'est que dans l'en-tête List-Unsubscribe (RFC 8058). Aucune image,
// aucun pixel. Toute valeur est échappée ; le texte est échappé PUIS ses retours deviennent <br/>.
// Textes portugais proposés, à relire par Hugo (H4) ; tant que H9 est ouverte, seul le français est activé (D-R8).
// Brouillon : gabarit et copie soumis à l'accord de Frédéric (F1).

/** Portées d'une diffusion (colonne signalements_qr_diffusions.portee). */
const PORTEES_DIFFUSION_QR = ['copropriete', 'batiment', 'etage', 'signalement'] as const satisfies readonly PorteeDiffusionQr[]

/** Valeurs figées d'une diffusion (signalements_qr_diffusions), seules sources du message. */
export interface DiffusionFigeeQr {
  /** signalements_qr_diffusions.id (étiquette « diffusion »). */
  id: string
  /** Langue du cabinet, figée à la création. */
  langue: LangueSignalementQr
  modele: ModeleDiffusionQr
  /** fige_cabinet_nom : bandeau, signature, pied. */
  cabinetNom: string
  /** fige_cabinet_identifiant : chemin de la page de désinscription. */
  cabinetIdentifiant: string
  coproprieteNom: string
  /** fige_contact_email : Reply-To et contact affiché. */
  contactEmail: string
  /** fige_politique_url : politique de confidentialité du cabinet (https). */
  politiqueUrl: string
  /** fige_expediteur : « "Nom du cabinet" <adresse> » (expediteurDiffusionQr, à la création). */
  expediteur: string
  objet: string
  texte: string
  portee: PorteeDiffusionQr
  /** Libellé du périmètre gardé à la création (libellePerimetreDiffusionQr) : « Bâtiment B · 3e étage ». */
  libellePerimetre: string
  /** created_at : date d'envoi écrite dans la copie au cabinet. */
  creeLe: string
  nbDestinataires: number
  acteurProfil: 'super_admin' | 'gestionnaire'
  /** Super admin : référence et date (AAAA-MM-JJ) de l'instruction écrite du cabinet. */
  instructionReference: string | null
  instructionRecueLe: string | null
}

const FORMAT_UUID_DIFFUSION_QR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORMAT_JOUR_QR = /^\d{4}-\d{2}-\d{2}$/

const ligneDiffusionQrSchema = z.object({
  id: z.string().regex(FORMAT_UUID_DIFFUSION_QR),
  langue: z.enum(['fr', 'pt']),
  modele: z.enum(MODELES_DIFFUSION_QR),
  fige_cabinet_nom: z.string(),
  fige_cabinet_identifiant: z.string(),
  fige_copropriete_nom: z.string(),
  fige_contact_email: z.string(),
  fige_politique_url: z.string(),
  fige_expediteur: z.string(),
  objet: z.string(),
  texte: z.string(),
  portee: z.enum(PORTEES_DIFFUSION_QR),
  libelle_perimetre: z.string(),
  created_at: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  nb_destinataires: z.number().int().min(1),
  acteur_profil: z.enum(['super_admin', 'gestionnaire']),
  instruction_reference: z.string().nullish(),
  instruction_recue_le: z.string().regex(FORMAT_JOUR_QR).nullish(),
}).refine((l) => l.acteur_profil !== 'super_admin' || (!!l.instruction_reference && !!l.instruction_recue_le))

/**
 * Ligne de signalements_qr_diffusions (colonnes ci-dessus ; les autres sont ignorées) → valeurs figées du message.
 * null si une colonne manque ou sort de ses valeurs (la route journalise et n'envoie rien).
 */
export function diffusionFigeeDepuisLigneQr(ligne: unknown): DiffusionFigeeQr | null {
  const lu = ligneDiffusionQrSchema.safeParse(ligne)
  if (!lu.success) return null
  const l = lu.data
  return {
    id: l.id.toLowerCase(),
    langue: l.langue,
    modele: l.modele,
    cabinetNom: l.fige_cabinet_nom,
    cabinetIdentifiant: l.fige_cabinet_identifiant,
    coproprieteNom: l.fige_copropriete_nom,
    contactEmail: l.fige_contact_email,
    politiqueUrl: l.fige_politique_url,
    expediteur: l.fige_expediteur,
    objet: l.objet,
    texte: l.texte,
    portee: l.portee,
    libellePerimetre: l.libelle_perimetre,
    creeLe: l.created_at,
    nbDestinataires: l.nb_destinataires,
    acteurProfil: l.acteur_profil,
    instructionReference: l.instruction_reference ?? null,
    instructionRecueLe: l.instruction_recue_le ?? null,
  }
}

// ── Textes du message (cahier § 5.2 ; FR exact, PT proposé, H4) ──

export interface TextesDiffusionQr {
  titre: string
  /** Début de la ligne du périmètre : « Copropriété {copropriete} ». */
  copropriete: string
  /** Fin de la ligne du périmètre pour la portée « signalement ». */
  auSujetDuSignalement: string
  bonjour: string
  /** Raison de la réception (droit § 4.3). */
  raison: string
  /** Encadré séparé (RGPD art. 21.4), au-dessus du bouton. */
  encadre: string
  bouton: string
  envoyePar: string
  traitesPar: string
  politique: string
  contact: string
  repondre: string
  /** Séparateur avant une adresse dans la version texte (« : » précédé d'une espace en français). */
  deuxPoints: string
}

export const TEXTES_DIFFUSION_QR: Record<LangueSignalementQr, TextesDiffusionQr> = parLangue<TextesDiffusionQr>({
  titre: { fr: 'Information sur votre immeuble', pt: 'Informação sobre o seu prédio' },
  copropriete: { fr: 'Copropriété {copropriete}', pt: 'Condomínio {copropriete}' },
  auSujetDuSignalement: { fr: 'au sujet du problème que vous avez signalé', pt: 'sobre o problema que comunicou' },
  bonjour: { fr: 'Bonjour,', pt: 'Olá,' },
  raison: {
    fr: 'Vous recevez ce message parce que vous avez signalé un problème dans cette copropriété.',
    pt: 'Recebe esta mensagem porque comunicou um problema neste condomínio.',
  },
  encadre: {
    fr: 'Vous pouvez ne plus recevoir ces informations à tout moment, sans justification.',
    pt: 'Pode deixar de receber estas informações a qualquer momento, sem justificação.',
  },
  bouton: { fr: 'Ne plus recevoir les informations sur cet immeuble', pt: 'Deixar de receber as informações sobre este prédio' },
  envoyePar: { fr: 'Message envoyé par {cabinet}, qui gère cette copropriété.', pt: 'Mensagem enviada por {cabinet}, que administra este condomínio.' },
  traitesPar: { fr: 'Vos coordonnées sont traitées par {cabinet} :', pt: 'Os seus dados são tratados por {cabinet}:' },
  politique: { fr: 'Politique de confidentialité', pt: 'Política de privacidade' },
  contact: { fr: 'Contact : {contact}.', pt: 'Contacto: {contact}.' },
  repondre: { fr: 'Pour écrire au cabinet, répondez à ce message.', pt: 'Para escrever ao administrador, responda a esta mensagem.' },
  deuxPoints: { fr: ' : ', pt: ': ' },
})

/** Désignation de repli si le nom du cabinet est vide une fois nettoyé (garde : le nom est obligatoire en base). */
const CABINET_PAR_DEFAUT_DIFFUSION_QR: Record<LangueSignalementQr, string> = {
  fr: 'le cabinet de la copropriété',
  pt: 'a administração do condomínio',
}

/** Longueurs du cahier § 5.1 : nom de la copropriété dans l'objet, objet, nom d'affichage de l'expéditeur. */
const MAX_NOM_COPROPRIETE_OBJET_QR = 80
const MAX_OBJET_DIFFUSION_QR = 120
const MAX_NOM_AFFICHAGE_QR = 70

// ── Gardes (défense en profondeur : chaque valeur est déjà contrôlée par la base ou le serveur) ──

/** Valeur figée hors de sa forme : rien n'est construit. Le message ne recopie aucune valeur (adresse, texte). */
export type ChampDiffusionInvalideQr = 'identifiant' | 'destinataire' | 'expediteur' | 'contact' | 'politique' | 'jeton'

export class DiffusionInvalideQr extends Error {
  readonly champ: ChampDiffusionInvalideQr

  constructor(champ: ChampDiffusionInvalideQr) {
    super(`[AJ SIGNALEMENT] diffusion : valeur hors format (${champ})`)
    this.name = 'DiffusionInvalideQr'
    this.champ = champ
  }
}

function exigerQr(condition: boolean, champ: ChampDiffusionInvalideQr): void {
  if (!condition) throw new DiffusionInvalideQr(champ)
}

// Même langage que le CHECK signalements_qr_cabinets_diffusion_contact_format (casse admise ici).
const SOURCE_ADRESSE_QR = String.raw`[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+`
const FORMAT_ADRESSE_QR = new RegExp(`^${SOURCE_ADRESSE_QR}$`, 'i')
/** « "Nom" <adresse> » (nom nettoyé, 70 caractères au plus) ou l'adresse seule : forme produite par expediteurDiffusionQr. */
const FORMAT_EXPEDITEUR_QR = new RegExp(String.raw`^(?:"[^"\\<>,;\p{Cc}\p{Cf}]{1,${MAX_NOM_AFFICHAGE_QR}}" <${SOURCE_ADRESSE_QR}>|${SOURCE_ADRESSE_QR})$`, 'iu')
/**
 * Une seule adresse de destinataire : ni espace, ni séparateur de liste, ni chevron, ni guillemet double, ni contrôle.
 * L'apostrophe reste permise (o'brien@…) : l'adresse du dépôt (strictEmail, Zod) l'admet.
 */
const FORMAT_DESTINATAIRE_QR = /^[^\s@,;:<>"()[\]\\\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+@[^\s@,;:<>"()[\]\\\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+$/u
/** Même langage que le CHECK signalements_qr_cabinets_diffusion_politique_format (recopiée dans un href). */
const FORMAT_POLITIQUE_QR = /^https:\/\/[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+$/

const adresseValideQr = (adresse: string) => adresse.length <= 254 && FORMAT_ADRESSE_QR.test(adresse)
const politiqueValideQr = (url: string) => url.length >= 12 && url.length <= 508 && FORMAT_POLITIQUE_QR.test(url)

/**
 * Adresse de politique de confidentialité recopiable dans un href (même langage que la contrainte de la base) : accusé
 * de réception et formulaire public (PR 3, lot 7), en plus de la diffusion.
 */
export function politiqueConfidentialiteValideQr(url: unknown): url is string {
  return typeof url === 'string' && politiqueValideQr(url)
}

/** L'adresse peut-elle être le seul `to` d'un message (une adresse, sans séparateur) ? Pour filtrer avant l'envoi. */
export function adresseDestinataireDiffusionValideQr(email: string): boolean {
  return email.length <= 254 && FORMAT_DESTINATAIRE_QR.test(email)
}

// ── Enveloppe (cahier § 5.1) ──

/** Partie adresse de « Nom <adresse> » ou de « adresse », en minuscules ; null si elle n'est pas une adresse simple. */
function adresseExpediteurQr(valeur: string | undefined): string | null {
  const brute = (valeur ?? '').trim()
  const entreChevrons = /<([^<>]*)>\s*$/.exec(brute)
  const adresse = (entreChevrons ? entreChevrons[1] : brute).trim().toLowerCase()
  return adresseValideQr(adresse) ? adresse : null
}

/**
 * Expéditeur d'une diffusion, figé à la création (fige_expediteur) : « "Nom du cabinet nettoyé" <adresse> ». Adresse :
 * secret AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION (wrangler secret put), à défaut la partie adresse de RESEND_FROM_EMAIL, à
 * défaut l'adresse sans réponse du service (lib/email.ts). Nom d'affichage : nom du cabinet sans « " », « \ », « < »,
 * « > », « , », « ; », retours ni caractères de contrôle ou invisibles, 70 caractères au plus ; vide une fois nettoyé :
 * l'adresse seule.
 */
export function expediteurDiffusionQr(nomCabinet: string, env: Record<string, string | undefined> = process.env): string {
  const adresse = adresseExpediteurQr(env.AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION) ?? adresseExpediteurQr(env.RESEND_FROM_EMAIL) ?? NOREPLY_EMAIL
  const nom = nettoyerLigneDiffusionQr(nettoyerLigneDiffusionQr(nomCabinet).replace(/["\\<>,;]/g, ' '), MAX_NOM_AFFICHAGE_QR)
  return nom ? `"${nom}" <${adresse}>` : adresse
}

/**
 * Objet : « <nom de la copropriété> — <objet> », sur une ligne (retours, contrôles et invisibles remplacés ou retirés,
 * espaces réduites) ; nom de la copropriété coupé à 80 caractères, objet à 120.
 */
export function sujetDiffusionQr(nomCopropriete: string, objet: string): string {
  const copropriete = nettoyerLigneDiffusionQr(nomCopropriete, MAX_NOM_COPROPRIETE_OBJET_QR)
  const sujet = nettoyerLigneDiffusionQr(objet, MAX_OBJET_DIFFUSION_QR)
  return copropriete ? `${copropriete} — ${sujet}` : sujet
}

// ── Gabarit (cahier § 5.2) ──

/** « Copropriété X », puis « · Bâtiment B · 3e étage » (bâtiment, étage) ou « · au sujet du problème… » (signalement). */
function lignePerimetreDiffusionQr(t: TextesDiffusionQr, copropriete: string, portee: PorteeDiffusionQr, libelle: string): string {
  const debut = remplir(t.copropriete, { copropriete }).trim()
  if ((portee === 'batiment' || portee === 'etage') && libelle) return `${debut} · ${libelle}`
  if (portee === 'signalement') return `${debut} · ${t.auSujetDuSignalement}`
  return debut
}

const STYLE_BOUTON_QR = 'display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;'

/**
 * Message de diffusion (et d'annonce, H1) d'une diffusion figée, pour le lien de page d'un destinataire : objet, HTML et
 * version texte. Lève DiffusionInvalideQr si l'identifiant du cabinet, la politique ou le jeton sont hors format.
 */
export function templateDiffusionQr(diffusion: DiffusionFigeeQr, jetonPage: string): { subject: string; html: string; text: string } {
  exigerQr(identifiantCabinetLienValideQr(diffusion.cabinetIdentifiant), 'identifiant')
  exigerQr(FORMAT_JETON_DIFFUSION_QR.test(jetonPage), 'jeton')
  exigerQr(politiqueValideQr(diffusion.politiqueUrl), 'politique')
  const e = echapperHtml
  const t = TEXTES_DIFFUSION_QR[diffusion.langue]
  const urlPage = urlPageDesinscriptionQr(diffusion.cabinetIdentifiant, jetonPage)
  const cabinet = nettoyerLigneDiffusionQr(diffusion.cabinetNom) || CABINET_PAR_DEFAUT_DIFFUSION_QR[diffusion.langue]
  const copropriete = nettoyerLigneDiffusionQr(diffusion.coproprieteNom, MAX_NOM_COPROPRIETE_OBJET_QR)
  const perimetre = lignePerimetreDiffusionQr(t, copropriete, diffusion.portee, nettoyerLigneDiffusionQr(diffusion.libellePerimetre))
  const texte = diffusion.texte.replace(/\r\n?/g, '\n').trim()
  const envoyePar = remplir(t.envoyePar, { cabinet })
  const traitesPar = remplir(t.traitesPar, { cabinet })
  const contact = remplir(t.contact, { contact: diffusion.contactEmail })

  const paragraphe = (html: string, marge = '0 0 14px') => `<p style="margin:${marge};font-size:15px;line-height:1.55;color:#0D1B2E;">${html}</p>`
  const corps = `<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#4A5E78;">${e(perimetre)}</p>
          ${paragraphe(e(t.bonjour))}
          <div style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0D1B2E;">${e(texte).replace(/\n/g, '<br/>')}</div>
          ${paragraphe(e(cabinet), '0 0 22px')}
          <p style="margin:0;font-size:13px;line-height:1.5;color:#4A5E78;">${e(t.raison)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border:1px solid #E4DDD0;border-radius:12px;border-collapse:separate;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#0D1B2E;">${e(t.encadre)}</p>
              <a href="${e(urlPage)}" style="${STYLE_BOUTON_QR}">${e(t.bouton)}</a>
            </td></tr>
          </table>`
  const piedHtml = `${e(envoyePar)} ${e(traitesPar)} <a href="${e(diffusion.politiqueUrl)}" style="color:#4A5E78;">${e(t.politique)}</a> · ${e(contact)} ${e(t.repondre)}`
  const html = cadreEmailQr({ langue: diffusion.langue, bandeauHtml: e(cabinet), titreHtml: e(t.titre), corpsHtml: corps, piedHtml })

  const text = [
    cabinet,
    t.titre,
    perimetre,
    '',
    t.bonjour,
    '',
    texte,
    '',
    cabinet,
    '',
    t.raison,
    '',
    t.encadre,
    `${t.bouton}${t.deuxPoints}${urlPage}`,
    '',
    `${envoyePar} ${traitesPar} ${t.politique} (${diffusion.politiqueUrl}) · ${contact} ${t.repondre}`,
    '',
  ].join('\n')
  return { subject: sujetDiffusionQr(diffusion.coproprieteNom, diffusion.objet), html, text }
}

/**
 * Message d'un destinataire (ligne rendue par signalements_qr_diffusion_lot) : un seul `to`, ni cc ni bcc ; expéditeur
 * figé ; Reply-To = contact du cabinet ; en-têtes List-Unsubscribe et List-Unsubscribe-Post (RFC 8058) avec le jeton UN
 * CLIC ; bouton du corps avec le jeton de PAGE ; étiquettes lues par le webhook (type, diffusion, destinataire).
 * Jetons : signerLiensDiffusionQr(destinataire.id). Lève DiffusionInvalideQr si une valeur sort de sa forme (filtrer
 * d'abord l'adresse avec adresseDestinataireDiffusionValideQr) ; ne lit rien d'autre que ses paramètres.
 */
export function messageDiffusionQr(
  diffusion: DiffusionFigeeQr,
  destinataire: { id: string; email: string },
  jetons: { page: string; unClic: string },
): EmailPayload {
  exigerQr(FORMAT_UUID_DIFFUSION_QR.test(diffusion.id) && FORMAT_UUID_DIFFUSION_QR.test(destinataire.id), 'identifiant')
  exigerQr(identifiantCabinetLienValideQr(diffusion.cabinetIdentifiant), 'identifiant')
  const prefixe = `${destinataire.id.toLowerCase().replaceAll('-', '')}.`
  exigerQr([jetons.page, jetons.unClic].every((j) => FORMAT_JETON_DIFFUSION_QR.test(j) && j.startsWith(prefixe)), 'jeton')
  exigerQr(adresseDestinataireDiffusionValideQr(destinataire.email), 'destinataire')
  exigerQr(diffusion.expediteur.length <= 400 && FORMAT_EXPEDITEUR_QR.test(diffusion.expediteur), 'expediteur')
  exigerQr(adresseValideQr(diffusion.contactEmail), 'contact')
  const { subject, html, text } = templateDiffusionQr(diffusion, jetons.page)
  return {
    from: diffusion.expediteur,
    to: destinataire.email,
    replyTo: diffusion.contactEmail,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${urlUnClicDesinscriptionQr(jetons.unClic)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'type', value: 'aj-diffusion' },
      { name: 'diffusion', value: diffusion.id.toLowerCase() },
      { name: 'destinataire', value: destinataire.id.toLowerCase() },
    ],
  }
}

// ── Copie au cabinet (cahier § 5.6) ──

export interface TextesCopieDiffusionQr {
  sujet: string
  titre: string
  envoi: string
  parSuperAdmin: string
  parSuperAdminSansInstruction: string
  parGestionnaire: string
  personne: string
  personnes: string
  copropriete: string
  objet: string
  message: string
  raison: string
  piedDePage: string
  deuxPoints: string
}

export const TEXTES_COPIE_DIFFUSION_QR: Record<LangueSignalementQr, TextesCopieDiffusionQr> = parLangue<TextesCopieDiffusionQr>({
  sujet: { fr: 'Copie — {copropriete} — {objet}', pt: 'Cópia — {copropriete} — {objet}' },
  titre: { fr: 'Copie d’un message diffusé', pt: 'Cópia de uma mensagem enviada' },
  envoi: {
    fr: 'Copie — message envoyé {auteur} le {date} à {destinataires} ({perimetre}).',
    pt: 'Cópia — mensagem enviada {auteur} em {date} a {destinataires} ({perimetre}).',
  },
  parSuperAdmin: {
    fr: 'par l’administrateur VitFix, sur votre instruction du {date} (référence : {reference})',
    pt: 'pelo administrador VitFix, conforme a vossa instrução de {date} (referência: {reference})',
  },
  parSuperAdminSansInstruction: { fr: 'par l’administrateur VitFix', pt: 'pelo administrador VitFix' },
  parGestionnaire: { fr: 'par un gestionnaire', pt: 'por um gestor' },
  personne: { fr: '{n} personne', pt: '{n} pessoa' },
  personnes: { fr: '{n} personnes', pt: '{n} pessoas' },
  copropriete: { fr: 'Copropriété', pt: 'Condomínio' },
  objet: { fr: 'Objet', pt: 'Assunto' },
  message: { fr: 'Message', pt: 'Mensagem' },
  raison: {
    fr: 'Vous recevez cette copie parce que la diffusion d’informations aux déclarants est activée pour votre cabinet. Elle ne contient pas l’adresse des personnes destinataires.',
    pt: 'Recebe esta cópia porque o envio de informações a quem comunicou ocorrências está ativado para a sua administração. Não contém o endereço das pessoas destinatárias.',
  },
  piedDePage: {
    fr: 'AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.',
    pt: 'AJ Signalement — um serviço VITFIX. Este e-mail foi enviado automaticamente.',
  },
  deuxPoints: { fr: ' : ', pt: ': ' },
})

const LOCALE_JOUR_QR: Record<LangueSignalementQr, string> = { fr: 'fr-FR', pt: 'pt-PT' }

/** « 12 novembre 2026 » / « 12 de novembro de 2026 » pour une date AAAA-MM-JJ (sans heure) ; la chaîne brute sinon. */
function jourQr(jour: string, langue: LangueSignalementQr): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  if (!m) return jour
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(date.getTime())) return jour
  return new Intl.DateTimeFormat(LOCALE_JOUR_QR[langue], { timeZone: 'UTC', dateStyle: 'long' }).format(date)
}

/** « par l’administrateur VitFix, sur votre instruction du … (référence : …) » ou « par un gestionnaire ». */
function auteurCopieQr(d: DiffusionFigeeQr, t: TextesCopieDiffusionQr): string {
  if (d.acteurProfil === 'gestionnaire') return t.parGestionnaire
  const reference = d.instructionReference ? nettoyerLigneDiffusionQr(d.instructionReference) : ''
  if (!reference || !d.instructionRecueLe) return t.parSuperAdminSansInstruction
  return remplir(t.parSuperAdmin, { date: jourQr(d.instructionRecueLe, d.langue), reference })
}

/**
 * Copie d'une diffusion au contact du cabinet (responsable du traitement) : auteur (super admin et son instruction
 * écrite, ou « un gestionnaire »), date, nombre de personnes, périmètre, puis l'objet et le texte. AUCUN lien, aucun
 * jeton, aucune adresse de déclarant. Elle documente chaque envoi et fait voir vite un envoi inattendu. Dans la langue
 * de la diffusion ; même entrée → même sortie.
 */
export function templateCopieCabinetDiffusionQr(d: DiffusionFigeeQr): { subject: string; html: string; text: string } {
  const e = echapperHtml
  const t = TEXTES_COPIE_DIFFUSION_QR[d.langue]
  const copropriete = nettoyerLigneDiffusionQr(d.coproprieteNom, MAX_NOM_COPROPRIETE_OBJET_QR)
  const objet = nettoyerLigneDiffusionQr(d.objet, MAX_OBJET_DIFFUSION_QR)
  const texte = d.texte.replace(/\r\n?/g, '\n').trim()
  const envoi = remplir(t.envoi, {
    auteur: auteurCopieQr(d, t),
    date: dateHeureParis(d.creeLe, d.langue),
    destinataires: remplir(d.nbDestinataires === 1 ? t.personne : t.personnes, { n: d.nbDestinataires }),
    perimetre: nettoyerLigneDiffusionQr(d.libellePerimetre),
  })
  const corps = `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#0D1B2E;">${e(envoi)}</p>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${ligne(e(t.copropriete), e(copropriete))}${ligne(e(t.objet), `<strong>${e(objet)}</strong>`)}</table>
          ${blocDescription(e(t.message), e(texte).replace(/\n/g, '<br/>'))}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#4A5E78;">${e(t.raison)}</p>`
  const html = cadreEmailQr({ langue: d.langue, titreHtml: e(t.titre), corpsHtml: corps, piedHtml: e(t.piedDePage) })
  const text = [
    t.titre,
    '',
    envoi,
    '',
    `${t.copropriete}${t.deuxPoints}${copropriete}`,
    `${t.objet}${t.deuxPoints}${objet}`,
    '',
    `${t.message}${t.deuxPoints.trimEnd()}`,
    texte,
    '',
    t.raison,
    '',
    t.piedDePage,
    '',
  ].join('\n')
  const subject = nettoyerLigneDiffusionQr(remplir(t.sujet, { copropriete, objet }))
  return { subject, html, text }
}

/** Message de la copie : au seul contact du cabinet, expéditeur du service (pas de Reply-To, pas d'en-tête). */
export function messageCopieCabinetDiffusionQr(d: DiffusionFigeeQr): EmailPayload {
  exigerQr(FORMAT_UUID_DIFFUSION_QR.test(d.id), 'identifiant')
  exigerQr(adresseValideQr(d.contactEmail), 'contact')
  const { subject, html, text } = templateCopieCabinetDiffusionQr(d)
  return {
    to: d.contactEmail,
    subject,
    html,
    text,
    tags: [{ name: 'type', value: 'aj-diffusion-copie' }, { name: 'diffusion', value: d.id.toLowerCase() }],
  }
}

/**
 * Envoie la copie au cabinet (sendBatchEmails, un message) ; vrai si le service l'a acceptée (la route date alors
 * copie_cabinet_le). Échec : logger.warn avec l'identifiant de la diffusion seulement ; l'envoi aux déclarants
 * continue. Ne lève jamais.
 */
export async function envoyerCopieCabinetDiffusionQr(d: DiffusionFigeeQr): Promise<boolean> {
  let message: EmailPayload
  try {
    message = messageCopieCabinetDiffusionQr(d)
  } catch (erreur) {
    const champ = erreur instanceof DiffusionInvalideQr ? erreur.champ : 'inconnu'
    logger.warn('[AJ SIGNALEMENT] copie de la diffusion au cabinet non envoyée (valeur hors format)', { diffusionId: d.id, champ })
    return false
  }
  const acceptee = await envoyerUnQr(message)
  if (!acceptee) logger.warn('[AJ SIGNALEMENT] copie de la diffusion au cabinet non partie', { diffusionId: d.id })
  return acceptee
}
