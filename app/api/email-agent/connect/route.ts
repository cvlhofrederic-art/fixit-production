import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, resolveCabinetId } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentConnectSchema, emailAgentDisconnectSchema } from '@/lib/validation'
import { FOURNISSEURS } from '@/lib/email-agent/fournisseurs'

/**
 * Rôles autorisés à connecter (ou déconnecter) la boîte e-mail du cabinet : le syndic
 * titulaire et le super admin (dont le cabinet est son propre compte, resolveCabinetId).
 * Les jetons sont rangés par syndic_id = id du compte, que lisent poll, Alfredo et
 * send-response.
 */
const ROLES_CONNEXION_BOITE = new Set(['syndic', 'super_admin'])

/** Préfixe des e-mails de démonstration (seeds) : jamais effacés par la purge. */
const PREFIXE_EMAILS_DEMO = 'demo-'

// ── Initie le flux OAuth2 du fournisseur choisi (?provider=gmail|microsoft) ──
// Réponse : redirection vers le fournisseur, ou { url } avec ?format=json (le tableau de
// bord appelle la route avec l'en-tête Authorization et redirige lui-même : le jeton de
// session ne passe pas dans l'URL).
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const v = validateBody(emailAgentConnectSchema, params)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

    // Jeton : en-tête Authorization (tableau de bord v54) ou ?token= (ancien bouton).
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.replace('Bearer ', '') || v.data.token

    if (!bearerToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(bearerToken)
    if (error || !user || !ROLES_CONNEXION_BOITE.has(getUserRole(user))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const fournisseur = FOURNISSEURS[v.data.provider]
    const manquants = fournisseur.configurationManquante()
    if (manquants.length > 0) {
      logger.error('[email-agent/connect] configuration du fournisseur absente', { provider: fournisseur.id, manquants })
      return NextResponse.json({
        error: `Connexion ${fournisseur.nom} non configurée sur le serveur : ${manquants.join(', ')} manquant${manquants.length > 1 ? 's' : ''}.`,
      }, { status: 500 })
    }

    // CSRF : state = syndic_id:nonce, vérifié par le callback du fournisseur.
    const nonce = crypto.randomUUID()
    const urlAutorisation = fournisseur.urlAutorisation(`${user.id}:${nonce}`)

    // Nonce rangé en base pour que le callback le vérifie (10 min). Première connexion :
    // la ligne n'existe pas et access_token / token_expiry sont NOT NULL → ligne créée
    // avec des valeurs vides que le callback remplace. Ligne existante (reconnexion ou
    // changement de fournisseur) : seul le nonce change, les jetons en place (et leur
    // provider) restent valables jusqu'au retour du callback.
    const maintenant = new Date().toISOString()
    const nonceExpire = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { data: existante, error: lectureErr } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .select('syndic_id')
      .eq('syndic_id', user.id)
      .maybeSingle()
    if (lectureErr) {
      logger.error('[email-agent/connect] lecture syndic_oauth_tokens', lectureErr)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
    const { error: ecritureErr } = existante
      ? await supabaseAdmin
          .from('syndic_oauth_tokens')
          .update({ oauth_nonce: nonce, oauth_nonce_expires_at: nonceExpire, updated_at: maintenant })
          .eq('syndic_id', user.id)
      : await supabaseAdmin
          .from('syndic_oauth_tokens')
          .insert({
            syndic_id: user.id,
            provider: fournisseur.id,
            access_token: '',
            token_expiry: maintenant,
            oauth_nonce: nonce,
            oauth_nonce_expires_at: nonceExpire,
            updated_at: maintenant,
          })
    if (ecritureErr) {
      logger.error('[email-agent/connect] écriture du nonce', ecritureErr)
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }

    if (request.nextUrl.searchParams.get('format') === 'json') {
      return NextResponse.json({ url: urlAutorisation })
    }
    return NextResponse.redirect(urlAutorisation)
  } catch (err) {
    logger.error('[email-agent/connect/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Déconnecte la boîte du cabinet ───────────────────────────────────────────
// Supprime la ligne syndic_oauth_tokens du cabinet (Alfredo ne relève plus rien).
// ?purger=1 : efface aussi les e-mails analysés de ce cabinet, sauf ceux de démonstration
// (gmail_message_id « demo-… »). Réponse : { boitesSupprimees, emailsSupprimes }.
export async function DELETE(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams)
    const v = validateBody(emailAgentDisconnectSchema, params)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const purger = v.data.purger === '1' || v.data.purger === 'true'

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_CONNEXION_BOITE.has(getUserRole(user))) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

    const { error: jetonErr, count: boitesSupprimees } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .delete({ count: 'exact' })
      .eq('syndic_id', cabinetId)
    if (jetonErr) {
      logger.error('[email-agent/connect/DELETE] suppression de la boîte', { cabinetId, erreur: jetonErr.message })
      return NextResponse.json({ error: 'Déconnexion impossible' }, { status: 500 })
    }

    let emailsSupprimes = 0
    if (purger) {
      const { error: purgeErr, count } = await supabaseAdmin
        .from('syndic_emails_analysed')
        .delete({ count: 'exact' })
        .eq('syndic_id', cabinetId)
        .not('gmail_message_id', 'like', `${PREFIXE_EMAILS_DEMO}%`)
      if (purgeErr) {
        // La boîte est déjà déconnectée : on le dit, avec l'échec de la purge.
        logger.error('[email-agent/connect/DELETE] purge des e-mails analysés', { cabinetId, erreur: purgeErr.message })
        return NextResponse.json({
          boitesSupprimees: boitesSupprimees ?? 0,
          emailsSupprimes: 0,
          error: 'Boîte déconnectée, mais les e-mails analysés n’ont pas pu être effacés',
        }, { status: 500 })
      }
      emailsSupprimes = count ?? 0
    }

    logger.info('[email-agent/connect/DELETE] boîte déconnectée', { cabinetId, purger, emailsSupprimes })
    return NextResponse.json({ boitesSupprimees: boitesSupprimees ?? 0, emailsSupprimes })
  } catch (err) {
    logger.error('[email-agent/connect/DELETE] erreur inattendue', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
