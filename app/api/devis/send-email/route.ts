import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { echapperHtmlEmail as e, texteSurUneLigne } from '@/lib/sanitize'
import { devisEnvoiEmailSchema, TAILLE_MAX_PDF_EMAIL_OCTETS } from '@/lib/validation'

// POST /api/devis/send-email — Envoie un devis/facture PDF par email via Resend
// Attend : { to, docType, docNumber, docTitle, totalStr, clientName, companyName, companyPhone?, pdfBase64 }
//
// Le message part de l'adresse d'envoi de la plateforme : le serveur vérifie ce qu'il envoie.
//   - compte : un compte professionnel (compteProfessionnel) ;
//   - corps : une seule adresse valide, un type de document connu, des champs bornés (devisEnvoiEmailSchema) ;
//   - pièce jointe : un PDF, de 10 Mo au plus ;
//   - contenu : chaque valeur saisie est échappée dans le HTML, l'objet tient sur une ligne ;
//   - volume : limite par minute et plafond par 24 heures, comptés par compte.

const ENVOIS_MAX_PAR_MINUTE = 20
const ENVOIS_MAX_PAR_JOUR = 100
const JOUR_MS = 24 * 60 * 60 * 1000

/** Longueur en base64 d'un PDF de la taille maximale, et taille du corps qui le porte (marge pour les autres champs). */
const LONGUEUR_MAX_PDF_BASE64 = Math.ceil(TAILLE_MAX_PDF_EMAIL_OCTETS / 3) * 4
const TAILLE_MAX_CORPS = LONGUEUR_MAX_PDF_BASE64 + 64 * 1024
/** « %PDF- » suivi du chiffre de version, en base64 : les premiers caractères de tout PDF ainsi encodé. */
const EN_TETE_PDF_BASE64 = 'JVBERi0'
const MESSAGE_PDF_TROP_GROS = 'Le PDF dépasse 10 Mo : téléchargez-le, puis envoyez-le depuis votre messagerie.'

/**
 * Rôles que seule la plateforme attribue et auxquels le tableau de bord professionnel s'ouvre même sans fiche
 * (app/(commun)/pro/dashboard/page.tsx) : ils utilisent le formulaire qui appelle cette route.
 */
const ROLES_PRO_SANS_FICHE = new Set(['pro_conciergerie', 'pro_gestionnaire', 'super_admin'])
/**
 * Rôles qu'un compte peut prendre lui-même à l'inscription (lib/auth/roles-auto-attribuables.ts) : admis seulement
 * avec leur fiche professionnelle. Rôle vide : artisan inscrit avec confirmation d'e-mail, dont le rôle n'est pas
 * encore posé (middleware.ts, artisanSansRole).
 */
const ROLES_PRO_AVEC_FICHE = new Set(['artisan', 'pro_societe', ''])

/** Message rendu pour le premier champ refusé par le schéma. */
const MESSAGES_CHAMP: Record<string, string> = {
  to: 'Adresse e-mail du client invalide : saisissez une seule adresse, de la forme nom@domaine.fr.',
  docType: 'Type de document inconnu.',
  docNumber: 'Numéro du document manquant ou trop long (100 caractères au plus).',
  docTitle: "Titre du document trop long pour l'e-mail (500 caractères au plus).",
  totalStr: "Montant trop long pour l'e-mail (60 caractères au plus).",
  clientName: "Nom du client trop long pour l'e-mail (500 caractères au plus).",
  companyName: "Nom de l'entreprise trop long pour l'e-mail (300 caractères au plus).",
  companyPhone: "Téléphone trop long pour l'e-mail (60 caractères au plus).",
  pdfBase64: 'Pièce jointe manquante : le PDF du document est attendu.',
}

const refus = (message: string, status: number) => NextResponse.json({ error: message }, { status })

/**
 * Compte professionnel, vérifié par le serveur : un artisan ou une société qui a sa fiche professionnelle, ou un rôle
 * professionnel attribué par la plateforme. Tout autre compte (client, copropriétaire, syndic…) est refusé : le
 * formulaire qui appelle cette route ne lui est jamais proposé. « inconnu » : la fiche n'a pas pu être lue.
 */
async function compteProfessionnel(user: User): Promise<'oui' | 'non' | 'inconnu'> {
  const role = getUserRole(user)
  if (ROLES_PRO_SANS_FICHE.has(role)) return 'oui'
  if (!ROLES_PRO_AVEC_FICHE.has(role)) return 'non'
  const { data, error } = await supabaseAdmin.from('profiles_artisan').select('id').eq('user_id', user.id).limit(1)
  if (error) {
    logger.error('[devis/send-email] fiche professionnelle illisible', { code: error.code })
    return 'inconnu'
  }
  return data && data.length > 0 ? 'oui' : 'non'
}

export async function POST(request: NextRequest) {
  let user = await getAuthUser(request)
  if (!user) {
    try {
      const serverClient = await createServerSupabaseClient()
      const { data } = await serverClient.auth.getUser()
      user = data.user
    } catch (err) {
      logger.warn('[devis/send-email] session par cookie illisible', { exception: err instanceof Error ? err.name : typeof err })
    }
  }
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  if (!(await checkRateLimit(`send_devis_${user.id}`, ENVOIS_MAX_PAR_MINUTE, 60_000))) return rateLimitResponse()

  const compte = await compteProfessionnel(user)
  if (compte === 'inconnu') return refus('Vérification du compte impossible pour le moment. Réessayez dans un instant.', 503)
  if (compte === 'non') return refus("L'envoi de devis et de factures par e-mail est réservé aux comptes professionnels.", 403)

  if (Number(request.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) return refus(MESSAGE_PDF_TROP_GROS, 413)

  let brut: unknown
  try {
    brut = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const lu = devisEnvoiEmailSchema.safeParse(brut)
  if (!lu.success) {
    const champ = String(lu.error.issues[0]?.path[0] ?? '')
    return refus(MESSAGES_CHAMP[champ] ?? 'Corps de requête invalide', 400)
  }
  const { to, docType, docNumber, docTitle, totalStr, clientName, companyName, companyPhone, pdfBase64 } = lu.data

  if (pdfBase64.length > LONGUEUR_MAX_PDF_BASE64) return refus(MESSAGE_PDF_TROP_GROS, 413)
  if (!pdfBase64.startsWith(EN_TETE_PDF_BASE64)) return refus("La pièce jointe n'est pas un PDF.", 400)

  // Compté en dernier : une demande refusée plus haut ne consomme pas le plafond des 24 heures.
  if (!(await checkRateLimit(`send_devis_jour_${user.id}`, ENVOIS_MAX_PAR_JOUR, JOUR_MS))) {
    logger.warn('[devis/send-email] plafond des 24 heures atteint', { compte: user.id })
    return refus(
      `Limite de ${ENVOIS_MAX_PAR_JOUR} e-mails par 24 heures atteinte. Réessayez demain, ou téléchargez le PDF pour l'envoyer depuis votre messagerie.`,
      429,
    )
  }

  const typeLabel = docType === 'devis' ? 'Devis' : 'Facture'
  // Objet : texte brut, ramené à une ligne (pas d'échappement HTML : des entités s'y afficheraient).
  const societeObjet = texteSurUneLigne(companyName)
  const subject = `${typeLabel} ${texteSurUneLigne(docNumber)}${societeObjet ? ' — ' + societeObjet : ''}`

  // Corps : chaque valeur saisie passe par e() (fonction commune, lib/sanitize.ts) et ne devient jamais du balisage.
  const signature = `${e(companyName)}${companyPhone ? `<br>${e(companyPhone)}` : ''}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.5;">
      <p>Bonjour ${e(clientName)},</p>
      <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} N°${e(docNumber)}${docTitle ? ` — ${e(docTitle)}` : ''}${totalStr ? ` d'un montant de ${e(totalStr)}` : ''}.</p>
      <p>À votre disposition pour toute question.</p>
      <p>Cordialement,<br>${signature}</p>
    </div>
  `.trim()

  const filename = `${docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

  const result = await sendEmail({
    to,
    subject,
    html,
    attachments: [{ filename, content: pdfBase64 }],
    tags: [
      { name: 'doc_type', value: docType },
      { name: 'artisan_id', value: user.id },
    ],
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Erreur envoi' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: result.id })
}
