import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, locale: string = 'fr') {
  const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  // Chiffres ronds : pas de décimales si le prix est entier (ex: 60 € au lieu de 60,00 €)
  const isRound = price === Math.floor(price)
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: isRound ? 0 : 2,
  }).format(price)
}

export function formatDate(date: string, locale: string = 'fr') {
  const intlLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'long'
  }).format(new Date(date))
}

// profiles_artisan.legal_form reçoit le libellé SIRENE (app/api/verify-siret, app/api/artisan-company : « SARL »,
// « SASU », « SA à directoire », « SNC », « SCI », « SELARL », « Forme juridique 5202 »…) ou une saisie (« S.A.R.L. »,
// « Unipessoal Lda », « ENI »). Lu sans accents, points ni majuscules. Les formes individuelles passent en premier :
// l'EIRL en toutes lettres (« entrepreneur individuel à responsabilité limitée ») reste individuelle.
const FORME_INDIVIDUELLE = /\b(ei|eirl|eni|ae)\b|entrepreneur individuel|entreprise individuelle|micro|auto-? ?entrepreneur|nome individual|trabalhador independente|personne physique/
const FORME_SOCIETE = /\b(sarl|sas|sasu|eurl|sa|snc|sci|scp|scs|sca|scop|sel|selarl|selas|selafa|selca|selurl|lda|unipessoal)\b|societe|sociedade|limitada|anonym|anonima|responsabilite limitee|nom collectif/
// Catégorie juridique INSEE sans libellé connu (app/api/artisan-company) : 5xxx sociétés commerciales, 6xxx sociétés civiles.
const CATEGORIE_INSEE_SOCIETE = /^forme juridique [56]\d{3}$/

/**
 * Société ou artisan individuel, d'après profiles_artisan.legal_form (rôle de la colonne, migration 059).
 * Société : SARL, SAS, SASU, EURL, SA, SNC, SCI, SCP, SEL… ; au Portugal Lda, Unipessoal Lda, SA (sociedade).
 * Artisan individuel : entrepreneur individuel, EI, EIRL, micro ou auto-entrepreneur, ENI (empresário em nome
 * individual), trabalhador independente, association, forme inconnue ou non renseignée.
 */
export function estFormeSociete(legalForm: string | null | undefined): boolean {
  const forme = String(legalForm || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!forme || FORME_INDIVIDUELLE.test(forme)) return false
  return FORME_SOCIETE.test(forme) || CATEGORIE_INSEE_SOCIETE.test(forme)
}

/**
 * Chemin public de la fiche, selon la forme juridique (estFormeSociete) et la langue.
 * société    → /fr/societe/[slug] ou /pt/empresa/[slug]
 * individuel → /fr/artisan/[slug] ou /pt/profissional/[slug]
 */
export function getProfilePath(artisan: { slug?: string | null; id: string; legal_form?: string | null }, locale: string): string {
  const identifier = artisan.slug || artisan.id
  const isCompany = estFormeSociete(artisan.legal_form)
  if (locale === 'pt') {
    return isCompany ? `/pt/empresa/${identifier}` : `/pt/profissional/${identifier}`
  }
  return isCompany ? `/fr/societe/${identifier}` : `/fr/artisan/${identifier}`
}

/**
 * Génère un slug URL-safe depuis un nom (company_name)
 * "Lepore Sebastien" → "leporesebastien"
 * "Électricité Martin & Fils", "Marseille" → "electricite-martin-fils-marseille"
 */
export function generateSlug(name: string, city?: string): string {
  const raw = city ? `${name} ${city}` : name
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .substring(0, 60)
}
