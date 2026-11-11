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

import { sendBatchEmails, sendEmail, type EmailPayload, type EmailResult } from '@/lib/email'
import { logger } from '@/lib/logger'
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
}

/** Phrase de pied du message selon le destinataire (PR 1 : un gestionnaire n'a pas encore accès à l'espace). */
const SUIVI_PAR_CABINET_QR = 'Le cabinet suit ce signalement dans AJ Signalement.'

function ligne(libelle: string, valeurHtml: string): string {
  return `<tr>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#4A5E78;white-space:nowrap;vertical-align:top;">${libelle}</td>
      <td style="padding:8px 0;font-size:15px;color:#0D1B2E;vertical-align:top;">${valeurHtml}</td>
    </tr>`
}

export function templateSignalementQr({
  copropriete, signalement: s, origine = 'https://vitfix.io', destinataire = 'administrateur', mention = null,
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
  // Bouton de l'espace : l'administrateur seul (un gestionnaire n'y a pas encore accès, une adresse saisie jamais).
  const bouton = destinataire === 'administrateur'
    ? `<p style="margin:16px 0 0;">
            <a href="${e(urlTableau)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ouvrir le tableau des signalements</a>
          </p>`
    : ''
  const suivi = destinataire === 'gestionnaire' ? `<p style="margin:8px 0 0;font-size:13px;color:#4A5E78;">${SUIVI_PAR_CABINET_QR}</p>` : ''
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

/** Cadre commun aux deux e-mails : bandeau « AJ SIGNALEMENT » et titre, contenu, pied de page. Contenus déjà échappés. */
function cadreEmailQr(p: { langue: LangueSignalementQr; titreHtml: string; corpsHtml: string; piedHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="${p.langue}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0D1B2E;padding:24px 32px;">
          <span style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1.5px;">AJ SIGNALEMENT</span><br/>
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
    const { subject, html } = templateSignalementQr({ ...p, destinataire: d.type })
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

// ── Alertes au super admin (sans nom ni adresse de personne) ─────────────────

/** « Ce n'est pas moi » (P1-R17b). */
export const ALERTE_ADRESSE_CONTESTEE_QR = {
  objet: 'AJ Signalement — adresse de gestionnaire contestée',
  texte: 'Une adresse de gestionnaire a été contestée par son destinataire : aucun e-mail ne lui sera envoyé. Créez une fiche avec la bonne adresse, puis faites le départ de la fiche contestée.',
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
})

/** Objet : « Votre signalement n° 5F2C9A1E a bien été enregistré — Parc Belle Ombre » (texte brut, pas de HTML). */
export function sujetConfirmationQr(numero: string, nomCopropriete: string, langue: LangueSignalementQr): string {
  return remplir(TEXTES_CONFIRMATION_QR[langue].sujet, { numero, copropriete: nomCopropriete })
}

export interface ParametresConfirmationQr {
  copropriete: { nom: string }
  /** Le signalement enregistré ; sa langue est celle de la page publique. */
  signalement: SignalementQr
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
 * E-mail de confirmation : numéro, copropriété, date et heure de Paris, récapitulatif de la déclaration, suite.
 * Ni nom, ni téléphone, ni adresse e-mail (de personne), ni lien vers le tableau de bord.
 */
export function templateConfirmationQr({ copropriete, signalement: s }: ParametresConfirmationQr): { subject: string; html: string } {
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

  const corps = `${paragraphe(t.bonjour)}
          ${paragraphe(remplir(t.introduction, { copropriete: `<strong>${e(copropriete.nom)}</strong>`, numero: `<strong>${e(numero)}</strong>` }), '0 0 4px')}
          ${intertitre(t.recapitulatif)}
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lignes}</table>
          ${blocDescription(t.description, e(s.description).replace(/\r?\n/g, '<br/>'))}
          ${intertitre(t.suiteTitre)}
          ${paragraphe(t.suite, '0')}
          ${paragraphe(t.conserverNumero, '12px 0 0')}
          <p style="margin:24px 0 0;font-size:13px;color:#4A5E78;">${t.pasDeReponse}<br/>${t.pasVous}</p>`
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
