import type { Locale } from './config'

// ─── Liens de l'en-tête et du pied de page publics, langue par langue ───
//
// Liens que components/common/Header.tsx et Footer.tsx rendent dans toutes les langues (ConditionalLayout les place sur
// les pages publiques, hors accueils). FR et PT : chemin de la langue, sans préfixe ; LocaleLink ajoute /fr ou /pt.
//
// Les sections EN, NL et ES n'ont que leur accueil, leurs pages de service et, en anglais, les pages légales ; les
// pages communes de app/(commun)/ (connexion, espace pro, tableaux de bord) ne sont réécrites que sous /fr/ et /pt/
// (next.config.ts). Un lien vers une page qu'elles n'ont pas vise donc une page qui existe, langue comprise
// (LocaleLink ne préfixe pas un chemin qui a déjà la sienne) :
// - versAccueil : l'accueil de la section, où mènent déjà /en/search/, /en/reviews/ et /en/contact/ (redirections de
//   next.config.ts) et le lien de recherche de la page 404 EN ;
// - versPagePt : la page PT, ces sections visant Porto ;
// - versPageEn : la page EN, préfixée pour NL et ES (leur interface est en anglais, voir getUiLocale).
// Jamais de chemin sans langue : le middleware le préfixerait par la langue du cookie (/en/…), soit une 404.
// Test : tests/seo/liens-entete-pied-langues.test.tsx.

type CheminsParLangue = Record<Locale, string>

const versAccueil = (fr: string, pt: string): CheminsParLangue => ({ fr, pt, en: '/en/', nl: '/nl/', es: '/es/' })
const versPagePt = (fr: string, pt: string): CheminsParLangue => ({ fr, pt, en: `/pt${pt}`, nl: `/pt${pt}`, es: `/pt${pt}` })
const versPageEn = (fr: string, pt: string, en: string): CheminsParLangue => ({ fr, pt, en, nl: `/en${en}`, es: `/en${en}` })

export const LIENS_ENTETE_PIED = {
  // Particuliers
  recherche: versAccueil('/recherche', '/pesquisar'),
  simulateur: versPagePt('/simulateur-devis', '/simulador-orcamento'),
  tarifs: versPagePt('/tarifs', '/precos'),
  avis: versAccueil('/avis', '/avaliacoes'),
  // Professionnels et comptes
  connexion: versPagePt('/auth/login', '/auth/login'),
  devenirPartenaire: versPagePt('/pro/register', '/pro/register'),
  offresPro: versPagePt('/pro/tarifs', '/pro/tarifs'),
  faqPro: versPagePt('/pro/faq', '/pro/faq'),
  espaceArtisan: versPagePt('/artisan/dashboard', '/artisan/dashboard'),
  espacePro: versPagePt('/pro/dashboard', '/pro/dashboard'),
  espaceClient: versPagePt('/client/dashboard', '/client/dashboard'),
  // Légal
  mentionsLegales: versPageEn('/mentions-legales', '/avisos-legais', '/legal-notices'),
  cgu: versPageEn('/cgu', '/termos', '/terms'),
  confidentialite: versPageEn('/confidentialite', '/privacidade', '/privacy'),
  cookies: versPageEn('/cookies', '/politica-cookies', '/cookie-policy'),
  contact: versAccueil('/contact', '/contacto'),
} satisfies Record<string, CheminsParLangue>

export type LienEntetePied = keyof typeof LIENS_ENTETE_PIED
