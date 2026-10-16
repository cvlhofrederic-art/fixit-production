import { supabaseAdmin } from '@/lib/supabase-server'
import defaultMotifs from '@/lib/default-motifs.json'

// ═══════════════════════════════════════════════════════════════════════════
// Motifs par défaut d'un nouvel artisan selon son métier, insérés à
// l'inscription. Partagé par /api/seed-motifs (avec session) et
// /api/pro/register/motifs-artisan (sans session, confirmation d'e-mail active).
// ═══════════════════════════════════════════════════════════════════════════

// Mapping catégories d'inscription → id métier dans le JSON
const CATEGORY_TO_METIER: Record<string, string> = {
  // Électricité
  'electricite': 'electricien', 'electricien': 'electricien', 'elec': 'electricien',
  // Plomberie
  'plomberie': 'plombier', 'plombier': 'plombier', 'plomb': 'plombier',
  // Maçonnerie
  'maconnerie': 'macon', 'macon': 'macon', 'gros-oeuvre': 'macon',
  // Peinture
  'peinture': 'peintre', 'peintre': 'peintre', 'decoration': 'peintre',
  // Carrelage
  'carrelage': 'carreleur', 'carreleur': 'carreleur',
  // Menuiserie
  'menuiserie': 'menuisier', 'menuisier': 'menuisier', 'parquet': 'menuisier',
  // Couverture
  'toiture': 'couvreur', 'couvreur': 'couvreur', 'zingueur': 'couvreur', 'couverture': 'couvreur',
  // Plaquiste
  'plaquiste': 'plaquier', 'isolation': 'plaquier', 'placo': 'plaquier',
  // Chauffage
  'chauffage': 'chauffagiste', 'chauffagiste': 'chauffagiste', 'climatisation': 'chauffagiste', 'cvc': 'chauffagiste',
  // Jardin / Paysagiste
  'espaces-verts': 'jardinier', 'espaces_verts': 'jardinier', 'paysagiste': 'jardinier',
  'jardinier': 'jardinier', 'jardin': 'jardinier', 'elagage': 'jardinier',
  'amenagement-exterieur': 'jardinier', 'amenagement_exterieur': 'jardinier',
  // Serrurerie
  'serrurerie': 'serrurier', 'serrurier': 'serrurier', 'metallier': 'serrurier', 'ferronnerie': 'serrurier',
  // Nettoyage
  'nettoyage': 'nettoyage', 'proprete': 'nettoyage', 'menage': 'nettoyage',
  // Ramonage → fallback couvreur (univers toiture/conduits)
  'ramonage': 'couvreur', 'ramoneur': 'couvreur',
  // Piscine → fallback jardinier (extérieur)
  'piscine': 'jardinier', 'pisciniste': 'jardinier',
  // Store banne → fallback menuisier (pose/installation)
  'store-banne': 'menuisier', 'store_banne': 'menuisier', 'storiste': 'menuisier',
  // Débouchage → plombier (sous-spécialité)
  'debouchage': 'plombier', 'assainissement': 'plombier',
}

// Corps de réponse des deux routes, inchangé depuis /api/seed-motifs
export type ResultatSeedMotifs =
  | { skipped: true; reason: string }
  | { success: true; count: number; etapes_count: number; metiers: string[] }
  | { error: string }

export async function seedDefaultMotifs(artisan_id: string, categories: string[]): Promise<ResultatSeedMotifs> {
  // Vérifier qu'il n'a pas déjà des motifs (éviter les doublons)
  const { data: existing } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('artisan_id', artisan_id)
    .limit(1)

  if (existing && existing.length > 0) {
    return { skipped: true, reason: 'Motifs déjà existants' }
  }

  // Résoudre les métiers depuis les catégories
  const metierIds = new Set<string>()
  for (const cat of categories) {
    const normalized = (cat as string).toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
    const metierId = CATEGORY_TO_METIER[normalized]
    if (metierId) metierIds.add(metierId)
  }

  if (metierIds.size === 0) {
    return { skipped: true, reason: 'Aucun métier reconnu' }
  }

  // Collecter les motifs à insérer (dédupliqués par nom)
  const seenNames = new Set<string>()
  const motifsToInsert: Record<string, unknown>[] = []
  const etapesMap: Record<string, string[]> = {} // nom → étapes

  for (const metierId of metierIds) {
    const metierConfig = defaultMotifs.metiers.find((m: { id: string }) => m.id === metierId)
    if (!metierConfig) continue

    for (const motif of metierConfig.motifs) {
      if (seenNames.has(motif.nom)) continue
      seenNames.add(motif.nom)

      const unitMap: Record<string, string> = {
        'forfait': 'forfait', 'u': 'unite', 'm²': 'm2', 'ml': 'ml',
        'm³': 'm3', 'point': 'unite', 'h': 'heure',
      }
      const unitCode = unitMap[motif.unite] || motif.unite

      motifsToInsert.push({
        artisan_id,
        name: motif.nom,
        description: motif.description + (unitCode ? ` [unit:${unitCode}|min:0|max:0]` : ''),
        duration_minutes: 60,
        price_ht: 0,
        price_ttc: 0,
        active: true,
        validation_auto: false,
      })

      // Stocker les étapes si présentes
      const etapes = (motif as { etapes?: unknown }).etapes
      if (Array.isArray(etapes) && etapes.length > 0) {
        etapesMap[motif.nom] = etapes
      }
    }
  }

  if (motifsToInsert.length === 0) {
    return { skipped: true, reason: 'Aucun motif à insérer' }
  }

  // Insérer les motifs en batch
  const { data: inserted, error } = await supabaseAdmin
    .from('services')
    .insert(motifsToInsert)
    .select('id, name')

  if (error) {
    console.error('[seed-motifs] Insert error:', error.message)
    return { error: 'Erreur serveur' }
  }

  // Insérer les étapes pour les motifs qui en ont
  let etapesCount = 0
  if (inserted) {
    for (const svc of inserted) {
      const etapes = etapesMap[svc.name]
      if (!etapes) continue
      const rows = etapes.map((d: string, i: number) => ({
        service_id: svc.id,
        ordre: i + 1,
        designation: d,
      }))
      const { error: etErr } = await supabaseAdmin.from('service_etapes').insert(rows)
      if (!etErr) etapesCount += rows.length
    }
  }

  return {
    success: true,
    count: inserted?.length || 0,
    etapes_count: etapesCount,
    metiers: Array.from(metierIds),
  }
}
