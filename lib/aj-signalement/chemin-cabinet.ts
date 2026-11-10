// ── AJ Signalement : chemin public de chaque cabinet client (vitfix.io/<identifiant>/…) ─────────────────────────
//
// Choix de Hugo du 10/11/2026 : chaque client a son chemin sur vitfix.io (pas de sous-domaine) :
//   - /<identifiant>/signalement/<jeton>/            page publique ouverte par le QR code ;
//   - /<identifiant>/confirmation-adresse/#<jeton>   confirmation d'adresse d'un gestionnaire (jeton après le « # ») ;
//   - /<identifiant>/suivi/, /<identifiant>/invitation/   réservés à la PR 2, non servis en PR 1.
// L'identifiant (« cabinet-exemple ») est saisi par le super admin dans l'espace, jamais écrit dans le code.
//
// Module pur, sans aucune dépendance à l'exécution : importé par le middleware (edge, AVANT la détection de langue),
// le navigateur et les tests. Il ne donne aucun droit : la page interne relit la copropriété par son jeton et vérifie
// qu'elle appartient au cabinet du chemin (sinon 404).
//
// Deux règles distinctes, à ne pas confondre :
//   1. le MOTIF du middleware (MOTIF_CHEMIN_CABINET_QR) est FIGÉ : il ne lit aucune liste. Si une route ajoutée plus
//      tard entrait dans une liste lue au routage, les QR codes déjà imprimés d'un cabinet de ce nom cesseraient de
//      marcher. Il ne masque une page que si elle a exactement « signalement/<32 hex> » ou « confirmation-adresse » en
//      2ᵉ segment, ce que tests/lib/aj-signalement-identifiants-reserves.test.ts interdit ;
//   2. la SAISIE de l'identifiant (validerIdentifiantCabinetQr) refuse le hors format et les noms réservés (routes du
//      site, préfixes, mots gardés). Le même test calcule les routes depuis le disque et next.config.ts et échoue si
//      l'une d'elles n'est pas réservée.

import type { CheminCabinetQr, ValidationIdentifiantCabinetQr } from '@/lib/aj-signalement/types'

export const LONGUEUR_MIN_IDENTIFIANT_CABINET_QR = 3
export const LONGUEUR_MAX_IDENTIFIANT_CABINET_QR = 40

/**
 * Format d'un identifiant (même langage que le CHECK signalements_qr_cabinets_identifiant_format) : minuscules,
 * chiffres, tirets simples, commence par une lettre, finit par une lettre ou un chiffre ; longueur testée à part.
 */
export const FORMAT_IDENTIFIANT_CABINET_QR = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/**
 * Identifiant tel que le routage le reconnaît (3 à 40 caractères ; jamais « api/ » ni « admin/ », que le middleware
 * laisse passer sans langue ; « _next » est exclu par la première lettre ; les langues, de 2 lettres, par la
 * longueur). Plus large que le format (« a--b » passe) : la saisie, plus stricte, refuse avant la base. Même texte
 * pour le middleware et, au lot 4, pour les réécritures de next.config.ts.
 */
export const SOURCE_IDENTIFIANT_CABINET_QR = '(?!(?:api|admin)/)[a-z][a-z0-9-]{1,38}[a-z0-9]'

/** Motif FIGÉ des chemins publics d'un cabinet, barre finale facultative. Sensible à la casse. */
export const MOTIF_CHEMIN_CABINET_QR = new RegExp(
  `^\\/(${SOURCE_IDENTIFIANT_CABINET_QR})\\/(?:signalement\\/([0-9a-f]{32})|(confirmation-adresse))\\/?$`,
)

/** 2ᵉ segment des chemins d'un cabinet : servis en PR 1 (signalement, confirmation-adresse), réservés à la PR 2. */
export const SEGMENTS_CABINET_QR = ['signalement', 'confirmation-adresse', 'suivi', 'invitation'] as const

/** Chemin public d'un cabinet (page de signalement ou de confirmation), ou null. Aucune lecture de base. */
export function cheminPublicCabinetQr(pathname: string): CheminCabinetQr | null {
  const m = MOTIF_CHEMIN_CABINET_QR.exec(pathname)
  if (!m) return null
  return m[2] ? { page: 'signalement', identifiant: m[1], jeton: m[2] } : { page: 'confirmation-adresse', identifiant: m[1] }
}

// ── Identifiants réservés (saisie seulement, jamais le routage) ──────────────

/**
 * Noms refusés comme identifiant de cabinet, relevés dans le code le 10/11/2026. Garde :
 * tests/lib/aj-signalement-identifiants-reserves.test.ts (disque + texte de next.config.ts).
 */
export const IDENTIFIANTS_RESERVES_QR: readonly string[] = [
  // Racine de app/ (dossiers, fichiers de métadonnées, gestionnaires de route) et middleware (sans langue).
  'api', 'admin', 'sitemap', 'robots', 'favicon', 'icon', 'apple-icon', 'manifest', 'llms', 'llms-full', 'indexnow-key',
  'global-error', 'global-not-found',
  // app/(commun)/ (servi sous /fr/ et /pt/ par réécriture) ; « cabinet » : pages internes du chemin client (lot 4).
  'administrateur-judiciaire', 'aj-signalement', 'artisan', 'auth', 'client', 'confidentialite', 'confirmation',
  'contact', 'cookies', 'coproprietaire', 'pro', 'rejoindre', 'rfq', 'signalement', 'simulateur', 'syndic', 'tracking',
  'cabinet',
  // app/fr/
  'a-propos', 'artisans-verifies', 'attestation-editeur', 'avis', 'blog', 'cgu', 'comment-ca-marche', 'copropriete',
  'devenir-partenaire', 'electricien-porto', 'entretien-appartement-porto', 'marches', 'mentions-legales', 'plan-du-site',
  'plombier-porto', 'pres-de-chez-moi', 'recherche', 'reserver', 'services', 'simulateur-devis', 'societe', 'specialites',
  'tarifs', 'travaux-appartement-porto', 'urgence', 'ville',
  // app/pt/ (urgencia et perto-de-mim : aussi consolidés par le middleware sans langue)
  'avaliacoes', 'avisos-legais', 'cidade', 'como-funciona', 'condominio', 'empresa', 'especialidades', 'mapa-do-site',
  'mercados', 'perto-de-mim', 'pesquisar', 'politica-cookies', 'precos', 'privacidade', 'profissionais-verificados',
  'profissional', 'servicos', 'simulador-orcamento', 'sobre', 'termos', 'torne-se-parceiro', 'urgencia',
  // app/en/
  'cookie-policy', 'emergency-home-repair-porto', 'legal-notices', 'privacy', 'terms',
  // Sources de next.config.ts absentes de app/ (premier segment, ou segment qui suit la langue).
  'mois', 'contacto', 'reservar', 'search', 'reviews',
  // public/
  'fonts', 'images',
  // Mots gardés pour l'avenir (services techniques, marque, espace des cabinets, PR 2).
  'www', 'app', 'static', 'assets', 'cdn', 'mail', 'email', 'support', 'aide', 'help', 'status', 'docs', 'legal',
  'vitfix', 'fixit', 'cabinets', 'clients', 'gestionnaire', 'gestionnaires', 'signalements', 'suivi', 'invitation',
  'connexion', 'login', 'logout', 'inscription', 'register', 'compte', 'account', 'dashboard', 'test', 'demo',
]

/**
 * Préfixes testés par startsWith SANS barre finale (ConditionalLayout : DASHBOARD_PATH_PREFIXES et
 * AUTH_BOOKING_PATH_PREFIXES ; middleware : '/administrateur-judiciaire') : un identifiant qui les prolonge
 * (« confirmation-x ») changerait l'habillage ou le contrôle de sa page. Garde : même test.
 */
export const PREFIXES_RESERVES_QR: readonly string[] = ['aj-signalement', 'administrateur-judiciaire', 'reserver', 'confirmation']

const RESERVES = new Set(IDENTIFIANTS_RESERVES_QR)

/** Identifiant saisi : tel quel (la saisie le rogne et le met en minuscules avant). Format, puis noms réservés. */
export function validerIdentifiantCabinetQr(identifiant: string): ValidationIdentifiantCabinetQr {
  if (
    typeof identifiant !== 'string'
    || identifiant.length < LONGUEUR_MIN_IDENTIFIANT_CABINET_QR
    || identifiant.length > LONGUEUR_MAX_IDENTIFIANT_CABINET_QR
    || !FORMAT_IDENTIFIANT_CABINET_QR.test(identifiant)
  ) {
    return { ok: false, raison: 'format' }
  }
  if (RESERVES.has(identifiant) || PREFIXES_RESERVES_QR.some((prefixe) => identifiant.startsWith(prefixe))) {
    return { ok: false, raison: 'reserve' }
  }
  return { ok: true }
}

/**
 * Proposition d'identifiant depuis le nom du cabinet (modifiable à l'écran) : accents retirés, minuscules, toute
 * suite de caractères hors lettres et chiffres → un tiret, commence par une lettre, 40 caractères au plus. Rendue
 * telle quelle, même trop courte ou réservée : l'écran la passe à validerIdentifiantCabinetQr.
 */
export function proposerIdentifiantCabinetQr(nom: string): string {
  const base = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
  return base.slice(0, LONGUEUR_MAX_IDENTIFIANT_CABINET_QR).replace(/-+$/, '')
}

// ── Adresses ─────────────────────────────────────────────────────────────────

const sansBarreFinale = (origine: string): string => origine.replace(/\/+$/, '')

/** Adresse publique du QR code d'une copropriété rattachée à un cabinet (barre finale : site en trailingSlash). */
export function urlSignalementCabinetQr(identifiant: string, jeton: string, origine = 'https://vitfix.io'): string {
  return `${sansBarreFinale(origine)}/${identifiant}/signalement/${jeton}/`
}

/**
 * Lien de confirmation d'adresse d'un gestionnaire : le jeton du lien est APRÈS le « # », jamais envoyé au serveur,
 * à Cloudflare ni dans l'en-tête Referer. Origine obligatoire (NEXT_PUBLIC_APP_URL côté route).
 */
export function urlConfirmationAdresseQr(identifiant: string, jetonLien: string, origine: string): string {
  return `${sansBarreFinale(origine)}/${identifiant}/confirmation-adresse/#${jetonLien}`
}
