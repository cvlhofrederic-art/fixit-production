// ══════════════════════════════════════════════════════════════════════════════
// lib/email-referral.ts — Templates email parrainage (4 emails)
// Utilise baseLayout() et sendEmail() de lib/email.ts
// ══════════════════════════════════════════════════════════════════════════════

import { sendEmail, type EmailResult } from '@/lib/email'
import { SITE_URL } from '@/lib/constants'

// ── Base layout (identique à lib/email.ts) ──────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0D1B2E;padding:24px 32px;text-align:center;">
          <span style="color:#C9A84C;font-size:24px;font-weight:700;letter-spacing:1px;">VITFIX</span>
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="background:#F7F4EE;padding:20px 32px;border-top:1px solid #E4DDD0;">
          <p style="margin:0;font-size:12px;color:#8A9BB0;text-align:center;">
            Cet email a été envoyé automatiquement par la plateforme VITFIX.<br/>
            <a href="${SITE_URL}" style="color:#C9A84C;text-decoration:none;">vitfix.io</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ══════════════════════════════════════════════════════════════════════════════
// 7.1 — Email filleul : Bienvenue + mois offert
// Déclenché à l'inscription du filleul
// ══════════════════════════════════════════════════════════════════════════════

export async function sendReferralWelcomeFilleul(params: {
  filleulEmail: string
  filleulName: string
  parrainName: string
}): Promise<EmailResult> {
  const { filleulEmail, filleulName, parrainName } = params

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      🎁 Votre 1er mois VITFIX est offert
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Bonjour <strong>${filleulName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Grâce à <strong>${parrainName}</strong>, votre premier mois d'abonnement Pro est offert.
      Il sera appliqué automatiquement lors de votre souscription.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF5E4;border-radius:12px;padding:20px;margin:0 0 20px;">
      <tr><td style="text-align:center;">
        <p style="margin:0;font-size:28px;">🎁</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#0D1B2E;">1 mois gratuit</p>
        <p style="margin:4px 0 0;font-size:13px;color:#B8860B;">Appliqué automatiquement à votre abonnement</p>
      </td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${SITE_URL}/pro/dashboard" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        Accéder à mon dashboard
      </a>
    </div>`

  return sendEmail({
    to: filleulEmail,
    subject: '🎁 Votre 1er mois VITFIX est offert',
    html: baseLayout(content),
    tags: [{ name: 'type', value: 'referral_welcome_filleul' }],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// 7.2 — Email parrain : Filleul inscrit
// Déclenché quand le filleul crée son compte
// ══════════════════════════════════════════════════════════════════════════════

export async function sendReferralNotifParrain(params: {
  parrainEmail: string
  parrainName: string
  filleulName: string
  referralCode: string
}): Promise<EmailResult> {
  const { parrainEmail, parrainName, filleulName, referralCode } = params
  const shareLink = `${SITE_URL}/rejoindre?ref=${referralCode}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      🎉 ${filleulName} a rejoint VITFIX grâce à vous !
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Bonjour <strong>${parrainName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      <strong>${filleulName}</strong> vient de créer son compte sur VITFIX grâce à votre lien de parrainage.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#E6F4F2;border-radius:12px;padding:20px;margin:0 0 20px;">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#1A7A6E;">
          📋 <strong>Prochaine étape :</strong> ${filleulName} souscrit un abonnement Pro
        </p>
        <p style="margin:8px 0 0;font-size:14px;color:#1A7A6E;">
          🎁 <strong>Votre récompense :</strong> 1 mois offert dès que son abonnement est confirmé (7 jours)
        </p>
      </td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${shareLink}" style="display:inline-block;background:#C9A84C;color:#0D1B2E;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        Partager à nouveau mon lien
      </a>
    </div>`

  return sendEmail({
    to: parrainEmail,
    subject: `🎉 ${filleulName} a rejoint VITFIX grâce à vous !`,
    html: baseLayout(content),
    tags: [{ name: 'type', value: 'referral_notif_parrain' }],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// 7.3 — Email parrain : Récompense confirmée (après J+7)
// ══════════════════════════════════════════════════════════════════════════════

export async function sendReferralRewardConfirmed(params: {
  parrainEmail: string
  parrainName: string
  filleulName: string
  totalParrainages: number
  referralCode: string
}): Promise<EmailResult> {
  const { parrainEmail, parrainName, filleulName, totalParrainages, referralCode } = params
  const shareLink = `${SITE_URL}/rejoindre?ref=${referralCode}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      🎉 Parrainage validé — 1 mois offert !
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Bonjour <strong>${parrainName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Votre parrainage de <strong>${filleulName}</strong> est validé.
      <strong>1 mois gratuit</strong> a été ajouté à votre compte.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF5E4;border-radius:12px;padding:20px;margin:0 0 20px;">
      <tr><td style="text-align:center;">
        <p style="margin:0;font-size:13px;color:#B8860B;font-weight:600;">VOS PARRAINAGES</p>
        <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0D1B2E;">${totalParrainages}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#8A9BB0;">artisan${totalParrainages > 1 ? 's' : ''} parrainé${totalParrainages > 1 ? 's' : ''} au total</p>
      </td></tr>
    </table>
    <div style="text-align:center;margin:28px 0;">
      <a href="${shareLink}" style="display:inline-block;background:#C9A84C;color:#0D1B2E;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        Parrainer un autre artisan
      </a>
    </div>`

  return sendEmail({
    to: parrainEmail,
    subject: `🎉 ${filleulName} est abonné — 1 mois offert !`,
    html: baseLayout(content),
    tags: [{ name: 'type', value: 'referral_reward_confirmed' }],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// 7.4 — Email parrain : Rappel filleul inactif (J+7 sans abonnement)
// Max 1 rappel par filleul
// ══════════════════════════════════════════════════════════════════════════════

export async function sendReferralReminderFilleul(params: {
  parrainEmail: string
  parrainName: string
  filleulName: string
  referralCode: string
}): Promise<EmailResult> {
  const { parrainEmail, parrainName, filleulName, referralCode } = params
  const shareLink = `${SITE_URL}/rejoindre?ref=${referralCode}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ⏳ ${filleulName} n'a pas encore activé son abonnement
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Bonjour <strong>${parrainName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      <strong>${filleulName}</strong> s'est inscrit sur VITFIX grâce à votre lien,
      mais n'a pas encore souscrit d'abonnement.
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Vous pouvez lui rappeler qu'il bénéficie d'un mois offert sur son premier abonnement.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${shareLink}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        Copier mon lien de parrainage
      </a>
    </div>`

  return sendEmail({
    to: parrainEmail,
    subject: `⏳ ${filleulName} n'a pas encore activé son abonnement`,
    html: baseLayout(content),
    tags: [{ name: 'type', value: 'referral_reminder_filleul' }],
  })
}
