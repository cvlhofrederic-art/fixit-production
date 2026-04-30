// ════════════════════════════════════════════════════════════════════════════
// VITFIX — Mapping NAF → corps de métier (slugs lib/categories.ts)
// ════════════════════════════════════════════════════════════════════════════
// Source de vérité : INSEE — Nomenclature d'Activités Française (NAF rév. 2)
// Ce mapping est utilisé à 2 endroits :
//   1. Au register (auto-pré-sélection après vérification SIRET)
//   2. En fallback runtime dans WalletConformiteSection si artisan.categories
//      est vide mais naf_code existe (sociétés inscrites avant ce fix).
// ----------------------------------------------------------------------------

/**
 * Retourne 1 à 3 corps de métier (slugs) déduits du code NAF.
 * Vide si NAF inconnu ou hors BTP/services artisan.
 *
 * @example
 *   getDefaultCategoriesFromNaf('41.20A') → ['renovation', 'maconnerie']
 *   getDefaultCategoriesFromNaf('43.21A') → ['electricite']
 *   getDefaultCategoriesFromNaf('81.30Z') → ['espaces-verts']
 */
export function getDefaultCategoriesFromNaf(nafCode: string | undefined | null): string[] {
  if (!nafCode) return []
  const c = nafCode.replace(/[.\s]/g, '').toUpperCase()

  // ─── F — Construction (NAF 41-43) ─────────────────────────────────────────
  // 41.10 → Promotion immobilière → pas un artisan, on retourne renovation par défaut
  if (c.startsWith('4120')) return ['renovation', 'maconnerie']  // Construction de bâtiments
  if (c.startsWith('41'))   return ['renovation']

  // 42 — Génie civil (routes, ouvrages d'art, réseaux)
  if (c.startsWith('42'))   return ['maconnerie']

  // 43.1 — Démolition / terrassement / forages
  if (c.startsWith('4311') || c.startsWith('4312') || c.startsWith('4313')) return ['maconnerie']

  // 43.2 — Installations
  if (c.startsWith('4321'))  return ['electricite']
  if (c.startsWith('4322A')) return ['plomberie']
  if (c.startsWith('4322B')) return ['chauffage', 'climatisation']
  if (c.startsWith('4322'))  return ['plomberie', 'chauffage']

  // 43.29 — Autres installations spéciales (isolation, store, piscine)
  if (c.startsWith('4329'))  return ['renovation']

  // 43.3 — Finitions
  if (c.startsWith('4331'))  return ['plaquiste']                  // Plâtrerie
  if (c.startsWith('4332A')) return ['menuiserie']                 // Menuiserie bois/PVC
  if (c.startsWith('4332B')) return ['metallerie']                 // Menuiserie métallique
  if (c.startsWith('4332'))  return ['menuiserie']
  if (c.startsWith('4333'))  return ['carrelage']                  // Revêtements sols/murs
  if (c.startsWith('4334'))  return ['peinture']                   // Peinture + vitrerie
  if (c.startsWith('4339'))  return ['renovation', 'plaquiste']    // Autres travaux finition

  // 43.9 — Couverture, gros œuvre spécialisé
  if (c.startsWith('4391'))  return ['toiture']
  if (c.startsWith('4399'))  return ['maconnerie']

  // 43 générique
  if (c.startsWith('43'))    return ['renovation']

  // ─── C — Métallurgie / fabrication métallique ─────────────────────────────
  if (c.startsWith('2562') || c.startsWith('2571') || c.startsWith('2572')) return ['serrurerie', 'metallerie']
  if (c.startsWith('25'))    return ['metallerie']

  // ─── N — Services aux bâtiments et aménagement paysager ───────────────────
  if (c.startsWith('8121'))  return ['nettoyage']                  // Nettoyage courant
  if (c.startsWith('8122'))  return ['nettoyage-industriel', 'ramonage']
  if (c.startsWith('8129'))  return ['traitement-nuisibles']       // Désinfection / désinsectisation
  if (c.startsWith('812'))   return ['nettoyage']
  if (c.startsWith('813') || c.startsWith('016')) return ['espaces-verts']

  // ─── H — Transport ─────────────────────────────────────────────────────────
  if (c.startsWith('4942'))  return ['demenagement']

  // ─── M — Activités spécialisées (diagnostic immobilier) ───────────────────
  if (c.startsWith('7120'))  return ['diagnostic']                 // Analyses, essais, inspections techniques
  if (c.startsWith('7490'))  return ['diagnostic']                 // Autres activités spécialisées

  // ─── S — Réparation de biens personnels et domestiques ────────────────────
  if (c.startsWith('952') || c.startsWith('951')) return ['petits-travaux']
  if (c.startsWith('95'))    return ['petits-travaux']

  // ─── Inconnu ───────────────────────────────────────────────────────────────
  return []
}

/**
 * Helper : combine catégories explicites (formulaire) avec celles dérivées
 * du NAF si pas encore renseignées. Utile en fallback runtime.
 */
export function resolveCategoriesWithNafFallback(
  categories: string | string[] | null | undefined,
  nafCode: string | null | undefined
): string[] {
  // Catégories déjà fournies → on les utilise
  if (Array.isArray(categories) && categories.length > 0) return categories
  if (typeof categories === 'string' && categories.trim().length > 0) return [categories]
  // Sinon, fallback sur le NAF
  return getDefaultCategoriesFromNaf(nafCode)
}
