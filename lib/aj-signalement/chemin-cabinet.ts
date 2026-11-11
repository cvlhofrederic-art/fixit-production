// ── AJ Signalement : chemin public de chaque cabinet client (vitfix.io/<identifiant>/…) ─────────────────────────
//
// Choix de Hugo du 10/11/2026 : chaque client a son chemin sur vitfix.io (pas de sous-domaine) :
//   - /<identifiant>/signalement/<jeton>/            page publique ouverte par le QR code ;
//   - /<identifiant>/confirmation-adresse/#<jeton>   confirmation d'adresse d'un gestionnaire (jeton après le « # ») ;
//   - /<identifiant>/invitation/#<jeton>             ouverture de l'accès d'un gestionnaire à l'espace de son cabinet
//     (PR 2, lot 3 ; lien de l'e-mail, publique comme la confirmation, jeton après le « # ») ;
//   - /<identifiant>/ (redirigé vers /suivi/), /<identifiant>/connexion/, /<identifiant>/suivi/   espace du cabinet
//     (PR 2, lot 4 ; Hugo, 11/11/2026, SPEC § 6) : connexion professionnelle DU cabinet et espace de suivi de ses
//     gestionnaires, avec session.
// L'identifiant (« cabinet-exemple ») est saisi par le super admin dans l'espace, jamais écrit dans le code.
//
// Module pur, sans aucune dépendance à l'exécution : importé par le middleware (edge, AVANT la détection de langue),
// le navigateur et les tests. Il ne donne aucun droit : la page interne relit la copropriété par son jeton et vérifie
// qu'elle appartient au cabinet du chemin (sinon 404) ; l'espace du cabinet est gardé par acces-espace.ts et chaque
// route /api/aj-signalement/* relit la fiche du gestionnaire.
//
// Trois règles distinctes, à ne pas confondre :
//   1. le MOTIF des pages publiques (MOTIF_CHEMIN_CABINET_QR) est FIGÉ : il ne lit aucune liste. Si une route ajoutée
//      plus tard entrait dans une liste lue au routage, les QR codes déjà imprimés d'un cabinet de ce nom cesseraient de
//      marcher. Il ne masque une page que si elle a exactement « signalement/<32 hex> », « confirmation-adresse » ou
//      « invitation » en 2ᵉ segment, ce que tests/lib/aj-signalement-identifiants-reserves.test.ts interdit ;
//   2. l'ESPACE du cabinet (cheminEspaceCabinetQr, lot 4) lit, lui, la liste des réservés : le risque est inverse. Sans
//      ce filtre, /aj-signalement/connexion/ (page de la #669, atteinte sans langue par 302) serait prise pour le
//      cabinet « aj-signalement », et le segment seul /<x>/ capterait toute page du site. Une route ajoutée plus tard au
//      nom d'un cabinet existant ne lui ferait perdre que les raccourcis de son espace, jamais ses QR codes ;
//   3. la SAISIE de l'identifiant (validerIdentifiantCabinetQr) refuse le hors format et les noms réservés (routes du
//      site, préfixes, mots gardés, valeurs des routes dynamiques de premier niveau des langues). Le même test calcule
//      les routes depuis le disque, next.config.ts et les modules de données, et échoue si l'une d'elles n'est pas
//      réservée.

import type { CheminCabinetQr, EspaceCabinetQr, ValidationIdentifiantCabinetQr } from '@/lib/aj-signalement/types'

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

/**
 * Motif FIGÉ des chemins publics d'un cabinet, barre finale facultative. Sensible à la casse. Pages publiques, sans
 * session : le QR code, la confirmation d'adresse et l'ouverture de l'accès (liens des e-mails, jeton après le « # »).
 */
export const MOTIF_CHEMIN_CABINET_QR = new RegExp(
  `^\\/(${SOURCE_IDENTIFIANT_CABINET_QR})\\/(?:signalement\\/([0-9a-f]{32})|(confirmation-adresse|invitation))\\/?$`,
)

/**
 * 2ᵉ segment des chemins d'un cabinet : signalement et confirmation-adresse (PR 1), invitation (PR 2, lot 3), suivi et
 * connexion (espace du cabinet, PR 2, lot 4). Aucune route du site ne doit les avoir en 2ᵉ segment (garde :
 * identifiants réservés).
 */
export const SEGMENTS_CABINET_QR = ['signalement', 'confirmation-adresse', 'suivi', 'invitation', 'connexion'] as const

/** Chemin public d'un cabinet (signalement, confirmation d'adresse, ouverture de l'accès), ou null. Aucune lecture de base. */
export function cheminPublicCabinetQr(pathname: string): CheminCabinetQr | null {
  const m = MOTIF_CHEMIN_CABINET_QR.exec(pathname)
  if (!m) return null
  if (m[2]) return { page: 'signalement', identifiant: m[1], jeton: m[2] }
  return m[3] === 'invitation' ? { page: 'invitation', identifiant: m[1] } : { page: 'confirmation-adresse', identifiant: m[1] }
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
  // Valeurs des routes dynamiques de premier niveau (PR 2, lot 4 : « /<x>/ » sans langue part aujourd'hui en 302 vers
  // « /<langue>/<x>/ ») : app/en/[slug] (lib/data/en-services-data.ts), app/nl/[slug] et app/es/[slug]
  // (lib/data/investor-pages-data.ts ; les slugs FR de ce module sont des dossiers de app/fr/, plus haut).
  'plumber-porto', 'emergency-plumber-porto', 'electrician-porto', 'handyman-porto', 'home-repair-porto',
  'property-maintenance-porto', 'english-speaking-plumber-porto', 'apartment-renovation-porto',
  'english-speaking-electrician-porto',
  'appartement-renovatie-porto', 'loodgieter-porto', 'elektricien-porto', 'appartement-onderhoud-porto',
  'reformas-apartamento-oporto', 'fontanero-oporto', 'electricista-oporto', 'mantenimiento-apartamento-oporto',
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

// ── Espace du cabinet (PR 2, lot 4) : avec session, identifiant valable seulement ──────────────────────────────

/**
 * Chemins de l'espace d'un cabinet, avant tout contrôle de la liste : « /<x> », « /<x>/ » (accueil), « /<x>/connexion »
 * et « /<x>/suivi » (barre finale facultative). Sensible à la casse. Jamais seul : cheminEspaceCabinetQr filtre ensuite
 * par validerIdentifiantCabinetQr (règle 2 de l'en-tête).
 */
const MOTIF_ESPACE_CABINET_QR = new RegExp(`^\\/(${SOURCE_IDENTIFIANT_CABINET_QR})(?:\\/(?:(connexion|suivi)\\/?)?)?$`)

/**
 * Espace d'un cabinet (accueil, connexion, suivi), ou null. Aucune lecture de base : un identifiant valable mais
 * inconnu mène à la connexion du cabinet, qui répond 404. Jamais un nom ou un préfixe réservé (routes du site, page de
 * connexion de l'espace global /aj-signalement/connexion/, langues, api, admin).
 */
export function cheminEspaceCabinetQr(pathname: string): EspaceCabinetQr | null {
  const m = MOTIF_ESPACE_CABINET_QR.exec(pathname)
  if (!m || !validerIdentifiantCabinetQr(m[1]).ok) return null
  const page = m[2] === 'connexion' || m[2] === 'suivi' ? m[2] : 'accueil'
  return { page, identifiant: m[1] }
}

/**
 * Page de l'espace d'un cabinet qui a sa propre coquille (connexion, suivi), sous l'adresse affichée (/<id>/suivi/) ou
 * sous la page interne de la réécriture (/cabinet/<id>/suivi/), selon ce que rend usePathname (ConditionalLayout).
 */
export function estEspaceCabinetQr(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const interne = /^\/cabinet(\/.+)$/.exec(pathname)
  const page = cheminEspaceCabinetQr(interne ? interne[1] : pathname)?.page
  return page === 'connexion' || page === 'suivi'
}

/** Espace de suivi d'un cabinet (barre finale : site en trailingSlash), sans langue. */
export const cheminSuiviCabinetQr = (identifiant: string): string => `/${identifiant}/suivi/`

/** Connexion professionnelle d'un cabinet, sans langue. */
export const cheminConnexionCabinetQr = (identifiant: string): string => `/${identifiant}/connexion/`

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

/**
 * Lien d'ouverture de l'accès d'un gestionnaire à l'espace de son cabinet (PR 2) : même règle que la confirmation, le
 * jeton du lien est APRÈS le « # ». Origine obligatoire (NEXT_PUBLIC_APP_URL côté route).
 */
export function urlInvitationAccesQr(identifiant: string, jetonLien: string, origine: string): string {
  return `${sansBarreFinale(origine)}/${identifiant}/invitation/#${jetonLien}`
}

/**
 * Bouton « Ouvrir le suivi » de l'e-mail d'un signalement (PR 2, RG-25) : l'espace du cabinet, vue Signalements. AUCUN
 * jeton : la page exige la session du gestionnaire (sinon sa connexion), les droits sont relus par chaque route.
 */
export function urlSuiviCabinetQr(identifiant: string, origine: string): string {
  return `${sansBarreFinale(origine)}${cheminSuiviCabinetQr(identifiant)}#signalements`
}
