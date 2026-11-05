// ── E-mail reçu par l'administrateur pour chaque signalement QR ───────────────
//
// Envoyé par Resend (lib/email.ts) aux destinataires de la copropriété (sinon ADMIN_EMAIL) ; « répondre »
// écrit directement au déclarant (replyTo). Tout ce que le déclarant a saisi est échappé avant d'entrer
// dans le HTML. Module serveur (il importe Resend) : les libellés partagés sont dans affichage.ts.

import { sendEmail, type EmailResult } from '@/lib/email'
import { CHEMIN_TABLEAU_QR, numeroSignalementQr, type SignalementQr } from '@/lib/aj-signalement/types'
import { LIBELLE_PRIORITE_QR, dateHeureParis, lieuSignalementQr } from '@/lib/aj-signalement/affichage'

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

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0D1B2E;padding:24px 32px;">
          <span style="color:#C9A84C;font-size:13px;font-weight:700;letter-spacing:1.5px;">AJ SIGNALEMENT</span><br/>
          <span style="color:#FFFFFF;font-size:22px;font-weight:700;">${urgent ? 'Signalement urgent' : 'Nouveau signalement'} — ${e(copropriete.nom)}</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          ${urgent ? '<p style="margin:0 0 16px;padding:10px 14px;background:#FBE4E1;border-radius:10px;color:#6E1C13;font-size:14px;font-weight:600;">Le déclarant indique une urgence (fuite importante, panne d’ascenseur, danger).</p>' : ''}
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lignes}</table>
          <p style="margin:20px 0 6px;font-size:13px;color:#4A5E78;">Description</p>
          <div style="padding:14px 16px;background:#F7F4EE;border-radius:12px;font-size:15px;line-height:1.55;color:#0D1B2E;">${description}</div>
          <p style="margin:24px 0 0;font-size:13px;color:#4A5E78;">Répondre à cet e-mail écrit directement au déclarant.</p>
          <p style="margin:16px 0 0;">
            <a href="${e(urlTableau)}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ouvrir le tableau des signalements</a>
          </p>
        </td></tr>
        <tr><td style="background:#F7F4EE;padding:18px 32px;border-top:1px solid #E4DDD0;">
          <p style="margin:0;font-size:12px;color:#8A9BB0;text-align:center;">Signalement déposé par QR code sur AJ Signalement — VITFIX. Cet e-mail a été envoyé automatiquement.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject: sujetSignalementQr(s, copropriete.nom), html }
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
