// ── E-mails d'un signalement QR : à l'administrateur, puis confirmation au déclarant ──
//
// Envoyés par Resend (lib/email.ts). Module serveur (il importe Resend) : les libellés partagés sont dans
// affichage.ts. Tout ce que le déclarant a saisi est échappé avant d'entrer dans le HTML.
//   - administrateur : destinataires de la copropriété (sinon ADMIN_EMAIL), en français ; « répondre » écrit
//     directement au déclarant (replyTo) ;
//   - déclarant : récapitulatif dans la langue de la page (FR / PT), envoyé à sa seule adresse, sans adresse de
//     réponse ni copie (l'adresse de l'administrateur et celle des destinataires n'y figurent jamais), sans
//     promesse d'intervention ni de délai. Limité par boîte de destination (formulaire public).

import { sendEmail, type EmailResult } from '@/lib/email'
import {
  CHEMIN_TABLEAU_QR, numeroSignalementQr, type LangueSignalementQr, type PrioriteSignalementQr, type SignalementQr,
} from '@/lib/aj-signalement/types'
import { LIBELLE_PRIORITE_QR, dateHeureParis, lieuSignalementQr } from '@/lib/aj-signalement/affichage'
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
}

function ligne(libelle: string, valeurHtml: string): string {
  return `<tr>
      <td style="padding:8px 12px 8px 0;font-size:13px;color:#4A5E78;white-space:nowrap;vertical-align:top;">${libelle}</td>
      <td style="padding:8px 0;font-size:15px;color:#0D1B2E;vertical-align:top;">${valeurHtml}</td>
    </tr>`
}

export function templateSignalementQr({ copropriete, signalement: s, origine = 'https://vitfix.io' }: ParametresEmailQr): { subject: string; html: string } {
  const e = echapperHtml
  const telephoneLien = s.telephone.replace(/[\s.()-]/g, '')
  const description = e(s.description).replace(/\r?\n/g, '<br/>')
  const urgent = s.priorite === 'urgente'
  const lignes = [
    ligne('Copropriété', `<strong>${e(copropriete.nom)}</strong>${copropriete.adresse ? `<br/><span style="color:#4A5E78;">${e(copropriete.adresse)}</span>` : ''}`),
    ligne('Déclarant', `<strong>${e(s.prenom)} ${e(s.nom)}</strong>`),
    ligne('Téléphone', `<a href="tel:${e(telephoneLien)}" style="color:#0D1B2E;">${e(s.telephone)}</a>`),
    ligne('E-mail', `<a href="mailto:${e(s.email)}" style="color:#0D1B2E;">${e(s.email)}</a>`),
    ligne('Lot', `${s.batiment ? `bât. ${e(s.batiment)} · ` : ''}étage ${e(s.etage)} · lot ${e(s.numLot)}`),
    ligne('Lieu du problème', e(lieuSignalementQr(s))),
    ligne('Type', e(s.typeIntervention)),
    ligne('Urgence', urgent ? '<strong style="color:#9B2C20;">Urgent</strong>' : e(LIBELLE_PRIORITE_QR[s.priorite])),
    ligne('Déposé le', e(dateHeureParis(s.creeLe))),
    ligne('Numéro', e(numeroSignalementQr(s.id))),
  ].join('')
  const urlTableau = `${origine.replace(/\/+$/, '')}${CHEMIN_TABLEAU_QR}`

  const corps = `${urgent ? '<p style="margin:0 0 16px;padding:10px 14px;background:#FBE4E1;border-radius:10px;color:#6E1C13;font-size:14px;font-weight:600;">Le déclarant indique une urgence (fuite importante, panne d’ascenseur, danger).</p>' : ''}
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lignes}</table>
          ${blocDescription('Description', description)}
          <p style="margin:24px 0 0;font-size:13px;color:#4A5E78;">Répondre à cet e-mail écrit directement au déclarant.</p>
          <p style="margin:16px 0 0;">
            <a href="${e(urlTableau)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ouvrir le tableau des signalements</a>
          </p>`
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

/** Envoie l'e-mail du signalement aux destinataires ; ne lève jamais (le résultat porte success / error). */
export async function envoyerEmailSignalementQr(p: ParametresEmailQr & { destinataires: string[] }): Promise<EmailResult> {
  const { subject, html } = templateSignalementQr(p)
  return sendEmail({
    to: p.destinataires,
    subject,
    html,
    replyTo: p.signalement.email,
    tags: [{ name: 'type', value: 'aj-signalement' }],
  })
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
  lieu: string
  zone: string
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
export const TEXTES_CONFIRMATION_QR: Record<LangueSignalementQr, TextesConfirmationQr> = {
  fr: {
    sujet: 'Votre signalement n° {numero} a bien été enregistré — {copropriete}',
    titre: 'Votre signalement est enregistré',
    bonjour: 'Bonjour,',
    introduction: 'Votre signalement pour la copropriété {copropriete} a bien été enregistré sous le numéro {numero}.',
    recapitulatif: 'Ce que vous avez déclaré',
    numero: 'Numéro',
    copropriete: 'Copropriété',
    deposeLe: 'Déposé le',
    heureParis: '(heure de Paris)',
    lieu: 'Lieu du problème',
    zone: 'Zone',
    type: 'Type de problème',
    urgence: 'Urgence',
    description: 'Description',
    partiesCommunes: 'Parties communes',
    votreLogement: 'Votre logement',
    batiment: 'bât.',
    etage: 'étage',
    lot: 'lot',
    priorites: { urgente: 'Urgent', normale: 'Normal', planifiee: 'À planifier' },
    suiteTitre: 'Et maintenant ?',
    suite: 'Votre signalement a été transmis à l’administrateur de la copropriété, qui pourra vous recontacter au téléphone ou à l’adresse e-mail que vous avez indiqués.',
    conserverNumero: 'Gardez ce numéro : il permet de retrouver votre signalement si vous en reparlez avec l’administrateur.',
    pasDeReponse: 'Message automatique : ne répondez pas à cet e-mail.',
    pasVous: 'Si vous n’êtes pas à l’origine de ce signalement, ignorez ce message.',
    piedDePage: 'AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.',
  },
  pt: {
    sujet: 'A sua ocorrência n.º {numero} foi registada — {copropriete}',
    titre: 'A sua ocorrência foi registada',
    bonjour: 'Olá,',
    introduction: 'A sua ocorrência relativa ao condomínio {copropriete} foi registada com o número {numero}.',
    recapitulatif: 'O que declarou',
    numero: 'Número',
    copropriete: 'Condomínio',
    deposeLe: 'Registada em',
    heureParis: '(hora de Paris)',
    lieu: 'Local do problema',
    zone: 'Zona',
    type: 'Tipo de problema',
    urgence: 'Urgência',
    description: 'Descrição',
    partiesCommunes: 'Partes comuns',
    votreLogement: 'A sua habitação',
    batiment: 'bloco',
    etage: 'piso',
    lot: 'fração',
    priorites: { urgente: 'Urgente', normale: 'Normal', planifiee: 'A planear' },
    suiteTitre: 'E agora?',
    suite: 'A sua ocorrência foi transmitida ao administrador do condomínio, que poderá contactá-lo pelo telefone ou pelo endereço de e-mail que indicou.',
    conserverNumero: 'Guarde este número: permite identificar a sua ocorrência se voltar a falar dela com o administrador.',
    pasDeReponse: 'Mensagem automática: não responda a este e-mail.',
    pasVous: 'Se não foi o autor desta ocorrência, ignore esta mensagem.',
    piedDePage: 'AJ Signalement — um serviço VITFIX. Este e-mail foi enviado automaticamente.',
  },
}

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
    ligne(t.lieu, lieuConfirmationHtml(s, t)),
    s.estPartieCommune && s.zoneSignalee ? ligne(t.zone, e(s.zoneSignalee)) : '',
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
