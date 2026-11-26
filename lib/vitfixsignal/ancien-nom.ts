// ── Vitfix Signal : ancien nom du produit, encore ACCEPTÉ en lecture (transition) ───────────────────────────────
//
// Décision du 26/11/2026 (référent métier) : le produit de signalements par QR code s'appelle « Vitfix Signal »
// (adresses /vitfixsignal/, /api/vitfixsignal/…). Son ancien nom reste ACCEPTÉ en lecture et en vérification pour tout
// ce qui existait en production ce jour-là ; rien n'est plus ÉCRIT, signé, envoyé ni affiché sous l'ancien nom.
//
// Ce module est le SEUL endroit du code où l'ancien nom est écrit. Hors de lui, il n'apparaît que dans :
//   - les tests de compatibilité (tests/lib/vitfixsignal-ancien-nom.test.ts et les fichiers qu'il nomme) ;
//   - la migration supabase/migrations/20261126b_vitfixsignal_renommage.sql (ancienne clé d'app_metadata) ;
//   - le workflow .github/workflows/vitfixsignal-diffusion-reprise.yml (ancienne variable de dépôt) ;
//   - la migration déjà appliquée 20261113 (clé d'un verrou de transaction, interne à une fonction SQL).
// Garde : tests/lib/vitfixsignal-ancien-nom.test.ts (« l'ancien nom n'est écrit nulle part ailleurs »).
//
// TRANSITION — ce qui est accepté, ce que cela protège, et QUAND le retirer (chaque bloc se retire seul) :
//
//   A. Adresses des pages (/fr/…, /pt/…, /en/…, /nl/…, /es/… et sans langue) : redirection permanente 308 du
//      middleware vers la même page sous le nouveau segment (favoris, liens des e-mails déjà reçus par
//      l'administrateur). Aucune échéance technique : à retirer quand le journal du Worker ne montre plus de visite,
//      au plus tôt un an après la mise en production. L'identifiant de cabinet de l'ancien segment reste, lui,
//      RÉSERVÉ SANS LIMITE (même après le retrait de la redirection) : un cabinet qui le prendrait recevrait les
//      anciens liens.
//
//   B. Routes d'API et route du filet de reprise : réécriture interne de next.config.ts (jamais une redirection : le
//      POST « un clic » RFC 8058 des messageries ne suit pas les redirections), exemption du contrôle d'Origin et
//      effacement du jeton chez Sentry pour l'ancienne adresse un clic. Protège l'en-tête List-Unsubscribe des messages
//      de diffusion DÉJÀ ENVOYÉS, honoré sans limite de durée tant que la diffusion existe en base (décision H5), donc
//      jusqu'à sa purge : 3 ans après sa création (signalements_qr_diffusion_purger, migration 20261113). À retirer
//      quand plus aucune diffusion créée avant la mise en production du renommage n'existe en base (une seule en
//      production, du 16/11/2026 : au plus tard le 17/11/2029). Les pages encore ouvertes dans un navigateur au
//      moment du déploiement, elles, ne comptent que pour quelques heures.
//
//   C. Liens de désinscription signés (contexte HKDF et usages signés d'avant) : même protection et même échéance que
//      B pour le lien un clic ; le lien de la page, lui, expire 365 jours après la diffusion
//      (VALIDITE_LIEN_DIFFUSION_JOURS, lib/vitfixsignal/diffusion-lien.ts). À retirer avec B.
//
//   D. Invitations des gestionnaires (nom d'espace signé d'avant, lib/equipe/lien-invitation.ts) : une invitation
//      expire 7 jours après sa création (DUREE_VALIDITE_MS, lib/equipe/invitation-serveur.ts). À retirer 7 jours après
//      la mise en production (plus aucune invitation signée sous l'ancien nom ne peut être acceptée).
//
//   E. Repère de routage des comptes (ancienne clé d'app_metadata) : à retirer quand la migration
//      20261126b_vitfixsignal_renommage.sql est appliquée ET que les sessions ouvertes avant elle ont été rafraîchies
//      (le jeton d'accès de Supabase vit une heure par défaut ; attendre un jour).
//
//   F. Secrets et variables (anciens noms lus en repli, lib/vitfixsignal/variables.ts) : à retirer quand les secrets
//      du Worker ont été reposés sous les nouveaux noms (wrangler secret put, MÊMES valeurs) puis les anciens
//      supprimés (wrangler secret delete), et la variable de dépôt GitHub recréée sous son nouveau nom.
//
//   G. Étiquettes « type » des e-mails déjà envoyés (webhook de Resend : plainte → opposition, objet et texte du
//      rebond tus à Sentry) : une plainte peut arriver tant que le message est dans une boîte. À retirer avec B.
//
// SANS compatibilité, volontairement :
//   - clés d'idempotence de Resend (préfixe des lots et de la copie d'une diffusion) : une clé ne vit que 24 heures chez
//     Resend et le filet ne reprend que les diffusions de moins d'une heure ; la seule diffusion de production
//     (16/11/2026) est terminée. Seule précaution : ne pas déployer pendant qu'une diffusion est en cours d'envoi (un lot
//     à l'issue incertaine serait rejoué sous une clé neuve, donc renvoyé une seconde fois) ;
//   - correspondance des colonnes d'un import retenue dans le navigateur (localStorage, clé renommée) : confort
//     seulement, l'écran repropose la correspondance au prochain import ;
//   - section de l'export des données d'un compte (/api/user/export-data) et identifiant de la carte du tableau de bord
//     d'administration : produits à la demande, relus par aucun programme, jamais stockés ;
//   - préfixes des journaux du serveur : seuls les filtres de recherche des journaux sont à recaler.
//
// Module PUR, sans aucun import : chargé par le middleware (edge), next.config.ts, les configurations de Sentry, le
// navigateur et les tests. Les modules qui l'importent par un chemin relatif (chemin-cabinet.ts, sentry-desinscription.ts)
// sont eux-mêmes chargés hors de l'alias « @/ » (next.config.ts, sentry.*.config.ts).

// ── A. Adresses des pages ──

/** Segment des pages de l'espace, sous son nom actuel (même valeur que SEGMENT_ESPACE_QR, acces-espace.ts). */
const SEGMENT_ACTUEL = '/vitfixsignal'

/** Ancien segment des pages de l'espace (espace du super admin et sa page de connexion). */
export const ANCIEN_SEGMENT_ESPACE_QR = '/aj-signalement'

/** Langues du site (mêmes valeurs que SUPPORTED_LOCALES, middleware.ts). */
const MOTIF_LANGUE = /^\/(fr|pt|en|nl|es)(?=\/|$)/

/**
 * Nouvelle adresse d'une ancienne page de l'espace, ou null si le chemin n'en est pas une. Segment EXACT, avec ou sans
 * langue, suite du chemin gardée telle quelle (« /connexion/ ») ; jamais un segment voisin, jamais une route d'API,
 * jamais la page publique ouverte par un QR code (/<identifiant>/signalement/<jeton>/, /fr/signalement/<jeton>/), dont
 * l'adresse ne change pas. Sensible à la casse, comme le reste du routage.
 */
export function redirectionAncienneAdresseQr(pathname: string): string | null {
  const langue = MOTIF_LANGUE.exec(pathname)?.[0] ?? ''
  const reste = pathname.slice(langue.length)
  if (reste !== ANCIEN_SEGMENT_ESPACE_QR && !reste.startsWith(`${ANCIEN_SEGMENT_ESPACE_QR}/`)) return null
  return `${langue}${SEGMENT_ACTUEL}${reste.slice(ANCIEN_SEGMENT_ESPACE_QR.length)}`
}

/**
 * Identifiants de cabinet réservés à cause de l'ancien nom (jamais libérés, voir A) : ajoutés aux noms et aux préfixes
 * réservés de lib/vitfixsignal/chemin-cabinet.ts.
 */
export const ANCIENS_IDENTIFIANTS_RESERVES_QR: readonly string[] = [ANCIEN_SEGMENT_ESPACE_QR.slice(1)]

// ── B. Routes d'API ──

/** Ancien préfixe des routes d'API (réécrit vers /api/vitfixsignal par next.config.ts). */
export const ANCIEN_PREFIXE_API_QR = '/api/aj-signalement'

/** Ancienne route du filet de reprise de la diffusion (réécrite vers /api/cron/vitfixsignal-diffusion-reprise). */
export const ANCIEN_CHEMIN_CRON_REPRISE_QR = '/api/cron/aj-diffusion-reprise'

// ── C. Liens de désinscription signés ──

/** Ancien contexte (info HKDF) de la clé des liens de désinscription. */
export const ANCIENNE_INFO_HKDF_LIENS_QR = 'aj-signalement-desinscription-v1'

/** Anciens usages signés des deux liens d'un message de diffusion. */
export const ANCIENS_USAGES_SIGNES_QR: Readonly<Record<'page' | 'un_clic', string>> = {
  page: 'aj-diffusion-page',
  un_clic: 'aj-diffusion-un-clic',
}

// ── D. Invitations des gestionnaires ──

/** Ancien nom de l'espace, tel qu'il entrait dans le message signé d'une invitation (lib/equipe/lien-invitation.ts). */
export const ANCIEN_ESPACE_INVITATION_QR = 'aj_signalement'

// ── E. Repère de routage des comptes ──

/** Ancienne clé du repère de routage dans app_metadata (la nouvelle : CLE_REPERE_CABINET_QR, acces-espace.ts). */
export const ANCIENNE_CLE_REPERE_CABINET_QR = 'aj_signalement_cabinet'

// ── F. Secrets et variables ──

/** Ancien nom de chaque secret ou variable du Worker, par nom actuel (lus en repli par lib/vitfixsignal/variables.ts). */
export const ANCIENS_NOMS_VARIABLES_QR = {
  VITFIXSIGNAL_CLE_LIENS_DIFFUSION: 'AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION',
  VITFIXSIGNAL_CLE_LIENS_DIFFUSION_PRECEDENTE: 'AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION_PRECEDENTE',
  VITFIXSIGNAL_EXPEDITEUR_DIFFUSION: 'AJ_SIGNALEMENT_EXPEDITEUR_DIFFUSION',
} as const

// ── G. Étiquettes des e-mails déjà envoyés ──

/** Ancienne étiquette « type » d'un message de diffusion (la plainte sur un tel message vaut opposition). */
export const ANCIEN_TYPE_ETIQUETTE_DIFFUSION_QR = 'aj-diffusion'

/** Anciennes étiquettes « type » de tous les e-mails du produit (signalement, alerte, accusé, adresse, accès, diffusion, copie). */
export const ANCIEN_MOTIF_TYPE_EMAIL_QR = /^aj-(?:signalement|diffusion)(?:-|$)/
