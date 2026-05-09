// ─── URL Translator across locales ───
//
// Quand l'utilisateur clique un drapeau, on doit lui afficher la page
// équivalente dans la langue cible — pas un 404 et pas la même URL avec
// un préfixe différent. La règle métier :
//
//   - Pages globales (CGU, à propos, blog…) : équivalent direct dans
//     chaque langue → on map explicitement.
//
//   - Pages SEO Marseille (`/fr/pres-de-chez-moi/*`, `/fr/services/*`…) :
//     marché local FR uniquement, aucun équivalent PT/EN/NL/ES → fallback
//     vers la home de la langue cible.
//
//   - Pages SEO Porto (audience investisseurs étrangers multilingues) :
//     même contenu décliné FR/PT/EN. Map explicite par paire de routes.
//
//   - NL/ES : seules les pages investisseurs existent (home + landing).
//     Tout le reste retombe sur la home NL/ES.
//
// La fonction `translateUrl` ne renvoie JAMAIS d'URL inexistante :
// si aucune correspondance n'est trouvée, on retourne `/<targetLocale>/`.

import type { Locale } from './config'

type RouteEquivalent = Partial<Record<Locale, string>>

// Liste des équivalences de routes connues, langue par langue.
// Une entrée = un même contenu décliné dans plusieurs locales.
const ROUTE_EQUIVALENTS: RouteEquivalent[] = [
  // ── Home ──
  { fr: '/fr/', pt: '/pt/', en: '/en/', nl: '/nl/', es: '/es/' },

  // ── Pages globales statiques (FR/PT/EN) ──
  { fr: '/fr/a-propos', pt: '/pt/sobre' },
  { fr: '/fr/cgu', pt: '/pt/termos', en: '/en/terms' },
  { fr: '/fr/mentions-legales', pt: '/pt/avisos-legais', en: '/en/legal-notices' },
  { pt: '/pt/privacidade', en: '/en/privacy' },
  { pt: '/pt/privacidade/meus-dados', en: '/en/privacy/my-data' },
  { pt: '/pt/politica-cookies', en: '/en/cookie-policy' },
  { fr: '/fr/comment-ca-marche', pt: '/pt/como-funciona' },
  { fr: '/fr/tarifs', pt: '/pt/precos' },
  { fr: '/fr/plan-du-site', pt: '/pt/mapa-do-site' },
  { fr: '/fr/marches', pt: '/pt/mercados' },
  { fr: '/fr/marches/publier', pt: '/pt/mercados/publicar' },
  { fr: '/fr/marches/gerer', pt: '/pt/mercados/gerir' },
  { fr: '/fr/devenir-partenaire', pt: '/pt/torne-se-parceiro' },
  { fr: '/fr/artisans-verifies', pt: '/pt/profissionais-verificados' },
  { fr: '/fr/recherche', pt: '/pt/pesquisar' },
  { fr: '/fr/blog', pt: '/pt/blog' },
  { fr: '/fr/simulateur-devis', pt: '/pt/simulador-orcamento' },
  { fr: '/fr/urgence', pt: '/pt/urgencia' },

  // ── Pages SEO Porto (audience multilingue : investisseurs étrangers) ──
  // Même service à Porto, langue différente. FR existe en route standalone.
  {
    fr: '/fr/plombier-porto',
    pt: '/pt/perto-de-mim/canalizador-porto',
    en: '/en/plumber-porto',
  },
  {
    fr: '/fr/electricien-porto',
    pt: '/pt/perto-de-mim/eletricista-porto',
    en: '/en/electrician-porto',
  },
  {
    fr: '/fr/entretien-appartement-porto',
    pt: '/pt/perto-de-mim/faz-tudo-porto',
    en: '/en/property-maintenance-porto',
  },
  {
    fr: '/fr/travaux-appartement-porto',
    pt: '/pt/perto-de-mim/obras-remodelacao-porto',
    en: '/en/apartment-renovation-porto',
  },
  // EN-only Porto pages : pas d'équivalent FR/PT existant côté routes.
  { en: '/en/emergency-home-repair-porto' },
  { en: '/en/handyman-porto' },
  { en: '/en/home-repair-porto' },
  { en: '/en/emergency-plumber-porto' },
  { en: '/en/english-speaking-plumber-porto' },
  { en: '/en/english-speaking-electrician-porto' },
]

const LOCALE_HOME: Record<Locale, string> = {
  fr: '/fr/',
  pt: '/pt/',
  en: '/en/',
  nl: '/nl/',
  es: '/es/',
}

function normalize(path: string): string {
  // Trailing slash retiré sauf pour la racine et les racines locales (`/fr/`).
  if (path === '/' || /^\/[a-z]{2}\/$/.test(path)) return path
  return path.replace(/\/+$/, '')
}

/**
 * Traduit l'URL courante vers la locale cible.
 * Retourne toujours une URL valide ; à défaut d'équivalent, la home de la langue cible.
 */
export function translateUrl(currentPath: string, targetLocale: Locale): string {
  const normalized = normalize(currentPath)

  for (const entry of ROUTE_EQUIVALENTS) {
    const matchedLocale = (Object.keys(entry) as Locale[]).find(
      (loc) => normalize(entry[loc]!) === normalized,
    )
    if (matchedLocale) {
      const target = entry[targetLocale]
      if (target) return target
      return LOCALE_HOME[targetLocale]
    }
  }

  return LOCALE_HOME[targetLocale]
}

/**
 * Renvoie l'ensemble des URLs équivalentes pour une page donnée, toutes locales confondues.
 * Sert à générer les `<link rel="alternate" hreflang>`.
 */
export function getAlternateUrls(currentPath: string): Partial<Record<Locale, string>> | null {
  const normalized = normalize(currentPath)
  for (const entry of ROUTE_EQUIVALENTS) {
    const match = (Object.keys(entry) as Locale[]).some(
      (loc) => normalize(entry[loc]!) === normalized,
    )
    if (match) return entry
  }
  return null
}
