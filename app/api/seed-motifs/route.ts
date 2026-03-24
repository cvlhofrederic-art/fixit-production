import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import defaultMotifs from '@/lib/default-motifs.json'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/seed-motifs
// Insère les motifs par défaut pour un nouvel artisan selon son métier.
// Appelé à l'inscription — non-bloquant, silencieux en cas d'erreur.
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
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`seed_motifs_${ip}`, 5, 60_000))) return rateLimitResponse()

  try {
    const { artisan_id, categories } = await request.json()

    if (!artisan_id || !Array.isArray(categories)) {
      return NextResponse.json({ error: 'artisan_id et categories requis' }, { status: 400 })
    }

    // Vérifier que l'artisan existe
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('id', artisan_id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Artisan non trouvé' }, { status: 404 })
    }

    // Vérifier qu'il n'a pas déjà des motifs (éviter les doublons)
    const { data: existing } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('artisan_id', artisan_id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ skipped: true, reason: 'Motifs déjà existants' })
    }

    // Résoudre les métiers depuis les catégories
    const metierIds = new Set<string>()
    for (const cat of categories) {
      const normalized = (cat as string).toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
      const metierId = CATEGORY_TO_METIER[normalized]
      if (metierId) metierIds.add(metierId)
    }

    if (metierIds.size === 0) {
      return NextResponse.json({ skipped: true, reason: 'Aucun métier reconnu' })
    }

    // Collecter les motifs à insérer (dédupliqués par nom)
    const seenNames = new Set<string>()
    const motifsToInsert: any[] = []

    for (const metierId of metierIds) {
      const metierConfig = defaultMotifs.metiers.find(m => m.id === metierId)
      if (!metierConfig) continue

      for (const motif of metierConfig.motifs) {
        if (seenNames.has(motif.nom)) continue
        seenNames.add(motif.nom)

        // Encoder l'unité dans la description comme le fait le système existant
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
      }
    }

    if (motifsToInsert.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'Aucun motif à insérer' })
    }

    // Insérer en batch
    const { data: inserted, error } = await supabaseAdmin
      .from('services')
      .insert(motifsToInsert)
      .select('id, name')

    if (error) {
      console.error('[seed-motifs] Insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: inserted?.length || 0,
      metiers: Array.from(metierIds),
    })

  } catch (e: any) {
    console.error('[seed-motifs] Error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
