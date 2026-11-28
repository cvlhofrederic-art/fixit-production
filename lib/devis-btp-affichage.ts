import type { TvaRegime } from '@/lib/tva-calculator'

/** Types de clients B2B de la base clients (`components/dashboard/ClientsSection.tsx`, groupe « b2b »). */
const TYPES_CLIENT_PROFESSIONNEL = new Set([
  'professionnel', 'societe', 'artisan_sous_traitant', 'syndic', 'conciergerie',
  'agence_immobiliere', 'promoteur', 'architecte', 'collectivite', 'association',
])

/**
 * Client professionnel, selon la règle de la base clients : un type B2B ou un SIRET renseigné. Le formulaire
 * de devis BTP s'en sert à l'import d'un client pour passer en « Professionnel » (raison sociale, SIRET) :
 * le type restait sur « Particulier ».
 */
export function estClientProfessionnel(client: { type?: unknown; siret?: unknown }): boolean {
  return TYPES_CLIENT_PROFESSIONNEL.has(String(client.type ?? '')) || String(client.siret ?? '').trim() !== ''
}

/**
 * Ligne TVA du résumé du devis BTP hors régime classique. L'autoliquidation et la franchise n'ont pas de taux :
 * le résumé affichait « TVA 20 % » et 0,00 €.
 */
export function ligneTvaHorsClassique(regime: TvaRegime): { libelle: string; valeur: string } | null {
  if (regime === 'autoliquidation_btp') return { libelle: 'TVA', valeur: 'Autoliquidation' }
  if (regime === 'franchise_293b') return { libelle: 'TVA', valeur: 'Non applicable' }
  return null
}

const PREFIXE_RCS = /\bR\.?\s?C\.?\s?S\.?(?=[\s:]|$)/gi
/** Saisie au Répertoire des métiers ou au registre national des entreprises : pas une immatriculation au RCS. */
const AUTRE_REGISTRE = /\bR\.?\s?M\.?(?=[\s:]|$)|\bRNE\b|r[ée]pertoire des m[ée]tiers/i
/** Mots qui accompagnent parfois le numéro sans en faire partie, et lettre A ou B de l'ancien format. */
const MOTS_PARASITES = /\b(?:SIREN|SIRET)\b|\bn°|\b[AB]\b/gi

/**
 * Immatriculation au RCS pour les mentions légales, sous la forme « RCS Aix-en-Provence 941 761 967 ».
 * Le champ des réglages se saisit avec son préfixe (exemple affiché « RM Marseille 953951589 ») ou dans l'ordre
 * du Kbis (« 941 761 967 R.C.S. Aix-en-Provence ») : le préfixe n'est écrit qu'une fois, là où la mention
 * donnait « Immatriculée au RCS de RCS Aix-en-Provence ». Une saisie à un autre registre (RM, RNE, Répertoire
 * des métiers) reste telle quelle ; « RCS » seul, sans ville ni numéro, rend une chaîne vide (« à renseigner »).
 */
export function formaterImmatriculationRcs(valeur: string | null | undefined): string {
  const brut = String(valeur ?? '').replace(/\s+/g, ' ').trim()
  if (!brut) return ''
  if (AUTRE_REGISTRE.test(brut)) return brut
  const sansPrefixe = brut.replace(PREFIXE_RCS, ' ').replace(MOTS_PARASITES, ' ').replace(/[:,]/g, ' ')
    .replace(/\s+/g, ' ').trim()
  const numero = /\d[\d ]{7,}\d/.exec(sansPrefixe)?.[0] ?? ''
  const chiffres = numero.replace(/\s/g, '')
  const ville = (numero ? sansPrefixe.replace(numero, ' ') : sansPrefixe).replace(/\s+/g, ' ').trim()
  if (!ville && !numero) return ''
  const numeroAffiche = chiffres.length === 9 ? chiffres.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : numero.trim()
  return ['RCS', ville, numeroAffiche].filter(Boolean).join(' ')
}
