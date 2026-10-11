import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, emailAgentConnectImapSchema } from '@/lib/validation'
import { chiffrerIdentifiantsImap } from '@/lib/email-agent/chiffrement'
import { ErreurImap, testerConnexionImap, type CodeErreurImap } from '@/lib/email-agent/imap/client'
import { EXPIRATION_IMAP, fournisseurImap } from '@/lib/email-agent/fournisseurs/imap'
import { declencherPremiereReleve } from '@/lib/email-agent/retour-oauth'

/**
 * POST /api/email-agent/connect-imap — connecte la boîte du cabinet par IMAP (« autre
 * messagerie » : OVH, Infomaniak, Gandi, Ionos, iCloud, Yahoo, serveur du cabinet…).
 *
 * Corps (Zod) : { email, utilisateur?, motDePasse, hote, port: 993 }. La connexion est
 * d'abord testée (authentification + boîte de réception) ; en cas de succès la ligne
 * syndic_oauth_tokens du cabinet est écrite avec provider 'imap', access_token =
 * identifiants chiffrés (AES-GCM), refresh_token vide, token_expiry lointain, puis la
 * première relève part après la réponse. Le mot de passe n'est jamais journalisé ni
 * renvoyé. Rôles : syndic titulaire et super admin (comme /api/email-agent/connect).
 */

const ROLES_CONNEXION_BOITE = new Set(['syndic', 'super_admin'])
const PREFIXE = '[email-agent/connect-imap]'

/** Tentatives de connexion par compte : 6 par tranche de 10 minutes. */
const TENTATIVES_MAX = 6
const FENETRE_TENTATIVES_MS = 10 * 60_000

const REPONSES_ERREUR: Record<CodeErreurImap, { status: number; message: string }> = {
  identifiants_refuses: {
    status: 400,
    message: 'Identifiant ou mot de passe refusé par le serveur. Gmail, iCloud, Yahoo : utilisez un mot de passe d’application.',
  },
  mot_de_passe_application: {
    status: 400,
    message: 'Ce fournisseur exige un mot de passe d’application : créez-en un dans la sécurité de votre compte e-mail, puis collez-le ici.',
  },
  microsoft_oauth: {
    status: 400,
    message: 'Outlook / Microsoft 365 n’accepte pas la connexion par mot de passe : utilisez le bouton « Outlook / Microsoft 365 ».',
  },
  authentification_non_prise_en_charge: {
    status: 400,
    message: 'Ce serveur n’accepte pas la connexion par mot de passe.',
  },
  boite_inaccessible: { status: 400, message: 'Connexion réussie, mais la boîte de réception est inaccessible.' },
  serveur_injoignable: {
    status: 502,
    message: 'Serveur IMAP injoignable : vérifiez son adresse (port 993, SSL/TLS).',
  },
  delai_depasse: { status: 504, message: 'Le serveur IMAP ne répond pas. Réessayez dans un instant.' },
  imap_indisponible: { status: 503, message: 'La connexion IMAP n’est pas disponible sur ce serveur.' },
  protocole: { status: 502, message: 'Réponse inattendue du serveur IMAP.' },
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_CONNEXION_BOITE.has(getUserRole(user))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Chaque essai ouvre une connexion vers un serveur choisi par l'utilisateur : borné
    // pour que la route ne serve pas à tester des mots de passe en série.
    if (!(await checkRateLimit(`email-agent-imap:${user.id}`, TENTATIVES_MAX, FENETRE_TENTATIVES_MS))) {
      return rateLimitResponse()
    }

    const corps: unknown = await request.json().catch((err: unknown) => {
      logger.warn(`${PREFIXE} corps illisible`, { erreur: err instanceof Error ? err.message : String(err) })
      return null
    })
    const v = validateBody(emailAgentConnectImapSchema, corps)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

    const manquants = fournisseurImap.configurationManquante()
    if (manquants.length > 0) {
      logger.error(`${PREFIXE} configuration absente`, { manquants })
      return NextResponse.json({
        error: `Connexion IMAP non configurée sur le serveur : ${manquants.join(', ')} manquant.`,
      }, { status: 500 })
    }

    const { email, motDePasse, hote, port } = v.data
    const identifiants = { hote, port, utilisateur: v.data.utilisateur || email, motDePasse }

    try {
      await testerConnexionImap(identifiants)
    } catch (err) {
      if (!(err instanceof ErreurImap)) throw err
      // Réponse du serveur et code seulement : ni mot de passe, ni identifiant complet.
      logger.warn(`${PREFIXE} connexion refusée`, { cabinetId: user.id, hote, code: err.code, detail: err.detail })
      const reponse = REPONSES_ERREUR[err.code]
      return NextResponse.json({ error: reponse.message, code: err.code }, { status: reponse.status })
    }

    const { error: ecritureErr } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .upsert({
        syndic_id: user.id,
        provider: fournisseurImap.id,
        access_token: await chiffrerIdentifiantsImap(identifiants),
        refresh_token: '',
        token_expiry: EXPIRATION_IMAP,
        email_compte: email,
        scope: `imap ${hote}:${port}`,
        oauth_nonce: null,
        oauth_nonce_expires_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'syndic_id' })
    if (ecritureErr) {
      logger.error(`${PREFIXE} enregistrement de la boîte`, { cabinetId: user.id, erreur: ecritureErr.message })
      return NextResponse.json({ error: 'Enregistrement de la boîte impossible' }, { status: 500 })
    }

    logger.info(`${PREFIXE} boîte IMAP connectée`, { cabinetId: user.id, hote })
    // Première relève (30 jours) après la réponse, comme au retour OAuth.
    declencherPremiereReleve(user.id, PREFIXE)

    return NextResponse.json({ connecte: true, provider: fournisseurImap.id, email })
  } catch (err) {
    logger.error(`${PREFIXE} erreur inattendue`, err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
